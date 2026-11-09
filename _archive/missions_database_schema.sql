-- ============================================================================
-- نظام المأموريات المتقدم - مخطط قاعدة البيانات
-- مأمورية فردي (موظف واحد) + مأمورية مجمع (مجموعة)
-- ============================================================================

-- ============================================================================
-- 1️⃣ جدول المأموريات الفردية
-- ============================================================================

CREATE TABLE missions_individual (
  id TEXT PRIMARY KEY,
  type TEXT DEFAULT 'individual', -- فردي

  -- بيانات المأمورية
  title TEXT NOT NULL,
  description TEXT,
  purpose TEXT,

  -- الموظف الواحد
  employee_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  employee_code TEXT,

  -- الجهة والموقع
  destination TEXT,
  department TEXT,

  -- التواريخ والأوقات
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,

  -- الحالة
  status TEXT DEFAULT 'pending', -- pending, approved, signed, completed, cancelled, rejected

  -- الموافقات والتوقيعات
  approvals JSONB DEFAULT '[]', -- {approver_id, approver_name, status, timestamp, notes}
  signatures TEXT[] DEFAULT '{}', -- قائمة معرفات التوقيعات

  -- المرفقات
  attachments JSONB DEFAULT '[]',

  -- نموذج GIECO
  gieco_form JSONB DEFAULT '{
    "department_manager_approval": false,
    "hr_approval": false,
    "employee_signature": false,
    "return_date": null,
    "actual_return_time": null
  }',

  -- البيانات الإدارية
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,

  -- ملاحظات
  notes TEXT,
  completion_notes TEXT,
  actual_return_time TIME,
  data JSONB DEFAULT '{}'
);

CREATE INDEX idx_missions_individual_status ON missions_individual(status);
CREATE INDEX idx_missions_individual_employee_id ON missions_individual(employee_id);
CREATE INDEX idx_missions_individual_created_by ON missions_individual(created_by);
CREATE INDEX idx_missions_individual_created_at ON missions_individual(created_at);

-- ============================================================================
-- 2️⃣ جدول المأموريات الجماعية
-- ============================================================================

CREATE TABLE missions_group (
  id TEXT PRIMARY KEY,
  type TEXT DEFAULT 'group', -- مجمع

  -- بيانات المأمورية
  title TEXT NOT NULL,
  description TEXT,
  purpose TEXT,

  -- الموظفون (مجموعة)
  employees JSONB NOT NULL, -- [{id, name, code, role, status}, ...]

  -- قائد المجموعة
  group_leader_id UUID NOT NULL,
  group_leader_name TEXT NOT NULL,

  -- الجهة والموقع
  destination TEXT,
  department TEXT,

  -- التواريخ والأوقات
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,

  -- الحالة
  status TEXT DEFAULT 'pending', -- pending, approved, in_progress, completed, cancelled, rejected

  -- الموافقات والتوقيعات (لكل موظف)
  approvals JSONB DEFAULT '[]', -- {employee_id, approver_id, status, timestamp}
  signatures TEXT[] DEFAULT '{}', -- قائمة معرفات التوقيعات

  -- المرفقات
  attachments JSONB DEFAULT '[]',

  -- نموذج GIECO
  gieco_form JSONB DEFAULT '{
    "department_manager_approval": false,
    "hr_approval": false,
    "group_leader_signature": false,
    "planned_return_date": null,
    "actual_return_date": null,
    "attendance_sheet": []
  }',

  -- البيانات الإدارية
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,

  -- ملاحظات
  notes TEXT,
  completion_notes TEXT,
  data JSONB DEFAULT '{}'
);

CREATE INDEX idx_missions_group_status ON missions_group(status);
CREATE INDEX idx_missions_group_group_leader_id ON missions_group(group_leader_id);
CREATE INDEX idx_missions_group_created_by ON missions_group(created_by);
CREATE INDEX idx_missions_group_created_at ON missions_group(created_at);

-- ============================================================================
-- 3️⃣ جدول سجل المأموريات (تاريخ العمليات)
-- ============================================================================

CREATE TABLE mission_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id TEXT NOT NULL,
  mission_type TEXT NOT NULL, -- individual, group

  -- العملية
  action TEXT NOT NULL, -- create, approve, sign, complete, reject, cancel
  action_by UUID NOT NULL,
  action_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- التفاصيل
  details JSONB,
  notes TEXT,

  -- البيانات
  old_data JSONB,
  new_data JSONB
);

CREATE INDEX idx_mission_logs_mission_id ON mission_logs(mission_id);
CREATE INDEX idx_mission_logs_action ON mission_logs(action);
CREATE INDEX idx_mission_logs_created_at ON mission_logs(action_at);

-- ============================================================================
-- 4️⃣ جدول قالب نموذج GIECO
-- ============================================================================

CREATE TABLE gieco_form_template (
  id TEXT PRIMARY KEY,
  mission_type TEXT NOT NULL, -- individual, group

  -- معلومات النموذج
  title TEXT NOT NULL,
  description TEXT,
  version TEXT DEFAULT '1.0',

  -- الحقول المطلوبة
  required_fields JSONB DEFAULT '[]',

  -- معلومات الموافقة
  approvers JSONB DEFAULT '[]',
  required_signatures INTEGER DEFAULT 2,

  -- البيانات الإضافية
  data JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5️⃣ جدول تقرير العودة من المأمورية
-- ============================================================================

CREATE TABLE mission_return_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id TEXT NOT NULL,
  mission_type TEXT NOT NULL,

  -- معلومات العودة
  employee_id UUID,
  group_leader_id UUID,

  return_date DATE,
  return_time TIME,
  actual_return_date DATE,
  actual_return_time TIME,

  -- التقرير
  report_summary TEXT,
  accomplishments TEXT,
  challenges TEXT,
  recommendations TEXT,

  -- الملفات المرفقة
  attachments JSONB DEFAULT '[]',

  -- البيانات
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID NOT NULL
);

CREATE INDEX idx_mission_return_reports_mission_id ON mission_return_reports(mission_id);
CREATE INDEX idx_mission_return_reports_created_at ON mission_return_reports(created_at);

-- ============================================================================
-- 6️⃣ الدوال المساعدة
-- ============================================================================

-- دالة لتحديث وقت التحديث
CREATE OR REPLACE FUNCTION update_mission_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- تطبيق الدالة
CREATE TRIGGER update_missions_individual_timestamp
BEFORE UPDATE ON missions_individual
FOR EACH ROW
EXECUTE FUNCTION update_mission_timestamp();

CREATE TRIGGER update_missions_group_timestamp
BEFORE UPDATE ON missions_group
FOR EACH ROW
EXECUTE FUNCTION update_mission_timestamp();

-- ============================================================================
-- 7️⃣ الآراء (Views)
-- ============================================================================

-- عرض المأموريات الفعالة حالياً
CREATE VIEW active_missions AS
SELECT
  id, title, type, status,
  CASE
    WHEN type = 'individual' THEN employee_name
    ELSE group_leader_name
  END as responsible_person,
  start_date, end_date,
  type as mission_type
FROM missions_individual
WHERE status IN ('pending', 'approved', 'signed')
  AND start_date <= CURRENT_DATE
  AND end_date >= CURRENT_DATE

UNION ALL

SELECT
  id, title, type, status,
  group_leader_name as responsible_person,
  start_date, end_date,
  type as mission_type
FROM missions_group
WHERE status IN ('pending', 'approved', 'in_progress')
  AND start_date <= CURRENT_DATE
  AND end_date >= CURRENT_DATE;

-- عرض المأموريات المتأخرة
CREATE VIEW overdue_missions AS
SELECT
  id, title, 'individual' as type, employee_name as person,
  end_date, status
FROM missions_individual
WHERE status != 'completed'
  AND end_date < CURRENT_DATE

UNION ALL

SELECT
  id, title, 'group' as type, group_leader_name as person,
  end_date, status
FROM missions_group
WHERE status != 'completed'
  AND end_date < CURRENT_DATE;

-- ============================================================================
-- 8️⃣ البيانات الافتراضية
-- ============================================================================

-- إضافة قالب نموذج GIECO
INSERT INTO gieco_form_template (id, mission_type, title, description, required_fields) VALUES
('gieco-individual', 'individual',
 'نموذج طلب مأمورية فردي',
 'نموذج GIECO الرسمي لطلب مأمورية فردي',
 '["employee_name", "destination", "purpose", "start_date", "end_date", "approver_signature"]'),

('gieco-group', 'group',
 'نموذج طلب مأمورية مجموعة',
 'نموذج GIECO الرسمي لطلب مأمورية مجموعة',
 '["group_leader_name", "employees_list", "destination", "purpose", "start_date", "end_date", "leader_signature"]');

-- ============================================================================
-- نهاية المخطط
-- ============================================================================

-- تفعيل RLS
ALTER TABLE missions_individual ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_return_reports ENABLE ROW LEVEL SECURITY;

-- سياسات القراءة
CREATE POLICY missions_individual_read ON missions_individual
  FOR SELECT
  USING (
    auth.uid() = created_by OR
    auth.uid() = employee_id OR
    auth.uid() = (SELECT approvals::jsonb ->> 'approver_id' LIMIT 1)
  );

CREATE POLICY missions_group_read ON missions_group
  FOR SELECT
  USING (
    auth.uid() = created_by OR
    auth.uid() = group_leader_id OR
    employees::jsonb @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
  );
