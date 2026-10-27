-- ============================================================================
-- منظومة السلامة HSE v5 - مخطط قاعدة البيانات
-- ============================================================================

-- ============================================================================
-- 1️⃣ جدول الملفات والمستندات
-- ============================================================================

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  type TEXT NOT NULL, -- image/jpeg, application/pdf, etc.
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  file_key TEXT NOT NULL UNIQUE, -- مفتاح التخزين في Supabase Storage
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_created_at ON documents(created_at);

-- ============================================================================
-- 2️⃣ جدول الإشعارات
-- ============================================================================

CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- info, warning, success, error
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  action_url TEXT,
  related_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- ============================================================================
-- 3️⃣ جدول التوقيعات الرقمية
-- ============================================================================

CREATE TABLE signatures (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  signer_id UUID NOT NULL,
  signer_name TEXT NOT NULL,
  signature_data TEXT NOT NULL, -- Base64 رسم أو صورة التوقيع
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  location TEXT,
  ip_address INET,
  notes TEXT,
  status TEXT DEFAULT 'signed', -- signed, verified, rejected
  is_valid BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE INDEX idx_signatures_document_id ON signatures(document_id);
CREATE INDEX idx_signatures_signer_id ON signatures(signer_id);
CREATE INDEX idx_signatures_timestamp ON signatures(timestamp);

-- ============================================================================
-- 4️⃣ جدول التصاريح
-- ============================================================================

CREATE TABLE permits (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, closed, expired
  priority TEXT DEFAULT 'normal', -- low, normal, high, critical
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- التواريخ
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  closed_at TIMESTAMP WITH TIME ZONE,

  -- الموافقات
  required_approvals INTEGER DEFAULT 1,
  approvals JSONB DEFAULT '[]', -- قائمة بالموافقات {approver_id, status, timestamp, notes}

  -- الرفض
  rejection_reason TEXT,
  rejected_by UUID,
  rejected_at TIMESTAMP WITH TIME ZONE,

  -- التمديدات
  extensions JSONB DEFAULT '[]', -- قائمة بطلبات التمديد

  -- المستندات المرفقة
  documents JSONB DEFAULT '[]', -- قائمة بالملفات {file_id, file_name, uploaded_by, uploaded_at}

  -- معلومات إضافية
  location TEXT,
  work_type TEXT,
  contractor TEXT,
  emergency_contact TEXT,
  data JSONB DEFAULT '{}'
);

CREATE INDEX idx_permits_status ON permits(status);
CREATE INDEX idx_permits_created_by ON permits(created_by);
CREATE INDEX idx_permits_created_at ON permits(created_at);
CREATE INDEX idx_permits_start_date ON permits(start_date);

-- ============================================================================
-- 5️⃣ جدول المهام والتكليفات
-- ============================================================================

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'assigned', -- assigned, in_progress, completed, rejected, cancelled
  priority TEXT DEFAULT 'normal', -- low, normal, high, critical

  -- الأشخاص المسؤولين
  created_by UUID NOT NULL,
  assigned_to UUID[] NOT NULL, -- مصفوفة من معرفات المستخدمين

  -- التواريخ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date DATE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- المرفقات
  attachments JSONB DEFAULT '[]', -- {file_id, file_name, uploaded_by, uploaded_at}

  -- السجل
  history JSONB DEFAULT '[]', -- {status_change, changed_by, changed_at, notes}

  -- بيانات إضافية
  estimated_hours DECIMAL,
  actual_hours DECIMAL,
  data JSONB DEFAULT '{}'
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_assigned_to ON tasks USING GIN(assigned_to);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_priority ON tasks(priority);

-- ============================================================================
-- 6️⃣ جدول النماذج والتقارير
-- ============================================================================

CREATE TABLE forms (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  form_type TEXT NOT NULL, -- incident, maintenance, inspection, etc.
  status TEXT DEFAULT 'draft', -- draft, submitted, approved, archived, rejected

  -- البيانات
  saved_by UUID NOT NULL,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,

  -- الموافقون
  approvers UUID[],
  required_signatures INTEGER DEFAULT 1,
  signatures TEXT[], -- مصفوفة من معرفات التوقيعات

  -- المحتوى
  data JSONB NOT NULL, -- البيانات الديناميكية للنموذج
  attachments JSONB DEFAULT '[]', -- المرفقات

  -- المراجع
  related_permit_id TEXT,
  related_task_id TEXT,
  related_incident_id TEXT,

  -- معلومات إضافية
  version INTEGER DEFAULT 1,
  archived_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_forms_form_type ON forms(form_type);
CREATE INDEX idx_forms_status ON forms(status);
CREATE INDEX idx_forms_saved_by ON forms(saved_by);
CREATE INDEX idx_forms_created_at ON forms(saved_at);

-- ============================================================================
-- 7️⃣ جدول سجل العمليات (Audit Log)
-- ============================================================================

CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL, -- create, update, delete, approve, reject, sign, etc.
  entity_type TEXT NOT NULL, -- permit, task, form, document, signature
  entity_id TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  status TEXT DEFAULT 'success', -- success, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- 8️⃣ جدول الإعدادات والتكوينات
-- ============================================================================

CREATE TABLE settings (
  id TEXT PRIMARY KEY,
  user_id UUID,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, key)
);

CREATE INDEX idx_settings_user_id ON settings(user_id);

-- ============================================================================
-- الآراء (Views)
-- ============================================================================

-- عرض التصاريح الفعالة حالياً
CREATE VIEW active_permits AS
SELECT *
FROM permits
WHERE status IN ('pending', 'approved')
  AND start_date <= NOW()
  AND end_date >= NOW();

-- عرض المهام المتأخرة
CREATE VIEW overdue_tasks AS
SELECT *
FROM tasks
WHERE status != 'completed'
  AND due_date < CURRENT_DATE;

-- عرض النماذج المعلقة (في انتظار التوقيع)
CREATE VIEW pending_signatures AS
SELECT f.id, f.title, f.form_type,
       array_length(f.signatures, 1) as signed_count,
       f.required_signatures,
       (f.required_signatures - COALESCE(array_length(f.signatures, 1), 0)) as remaining_signatures
FROM forms f
WHERE f.status = 'submitted'
  AND COALESCE(array_length(f.signatures, 1), 0) < f.required_signatures;

-- ============================================================================
-- الدوال (Functions)
-- ============================================================================

-- دالة لتحديث وقت التحديث تلقائياً
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- تطبيق الدالة على الجداول
CREATE TRIGGER update_documents_timestamp
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_permits_timestamp
BEFORE UPDATE ON permits
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_tasks_timestamp
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_forms_timestamp
BEFORE UPDATE ON forms
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- دالة لعد الإشعارات غير المقروءة
CREATE OR REPLACE FUNCTION count_unread_notifications(user_id UUID)
RETURNS INTEGER AS $$
SELECT COUNT(*)
FROM notifications
WHERE notifications.user_id = $1 AND read = FALSE;
$$ LANGUAGE sql;

-- دالة للتحقق من تصريح صالح
CREATE OR REPLACE FUNCTION check_permit_validity(permit_id TEXT)
RETURNS TABLE(is_valid BOOLEAN, reason TEXT) AS $$
SELECT
  (p.status = 'approved' AND p.start_date <= NOW() AND p.end_date >= NOW()) as is_valid,
  CASE
    WHEN p.status != 'approved' THEN 'التصريح غير معتمد'
    WHEN p.start_date > NOW() THEN 'التصريح لم يبدأ بعد'
    WHEN p.end_date < NOW() THEN 'انتهى التصريح'
    ELSE 'التصريح صالح'
  END as reason
FROM permits p
WHERE p.id = permit_id;
$$ LANGUAGE sql;

-- ============================================================================
-- سياسات الوصول (RLS - Row Level Security)
-- ============================================================================

-- تفعيل RLS على جميع الجداول
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- سياسة الوصول للإشعارات (المستخدم يرى إشعاراته فقط)
CREATE POLICY notifications_auth ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY notifications_insert ON notifications
  FOR INSERT
  WITH CHECK (TRUE);

-- سياسة الوصول للتوقيعات (قراءة عامة، كتابة للموقعين)
CREATE POLICY signatures_select ON signatures
  FOR SELECT
  USING (TRUE);

CREATE POLICY signatures_insert ON signatures
  FOR INSERT
  WITH CHECK (auth.uid() = signer_id);

-- ============================================================================
-- البيانات الافتراضية
-- ============================================================================

-- إضافة إعدادات افتراضية
INSERT INTO settings (id, key, value, description) VALUES
('config_1', 'email_notifications_enabled', '{"value": true}', 'تفعيل الإشعارات عبر البريد'),
('config_2', 'permit_auto_expiry_days', '{"value": 7}', 'عدد أيام انتهاء الصلاحية التلقائي للتصريح'),
('config_3', 'task_reminder_days_before', '{"value": 2}', 'عدد أيام التذكير قبل موعد انتهاء المهمة'),
('config_4', 'signature_validity_days', '{"value": 365}', 'عدد أيام صلاحية التوقيع الرقمي');

-- ============================================================================
-- نهاية المخطط
-- ============================================================================

-- ملاحظات:
-- 1. تأكد من تفعيل RLS على جميع الجداول
-- 2. اضبط سياسات الوصول حسب احتياجات تطبيقك
-- 3. أنشئ فهارس إضافية حسب احتياجات الأداء
-- 4. راقب نمو حجم الجداول واحتفظ بسجلات العمليات
