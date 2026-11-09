# 📚 دليل تطبيق نظام السلامة HSE v5 المتقدم

## 🎯 نظرة عامة

هذا الدليل يشرح الأنظمة الستة المتقدمة المدمجة في منظومة السلامة:

1. **نظام رفع الملفات والصور** 📄
2. **نظام الإشعارات** 🔔
3. **نظام التوقيعات الرقمية** ✍️
4. **نظام التصاريح المتقدم** 📋
5. **نظام التكليفات والمهام** ✓
6. **نظام النماذج والتقارير** 📈

---

## 1️⃣ نظام رفع الملفات والصور

### المميزات:
- ✅ رفع صور (JPG, PNG, WebP) و PDFs
- ✅ حد أقصى 10 MB لكل ملف
- ✅ تخزين آمن في Supabase Storage
- ✅ روابط موقعة صالحة لمدة ساعة

### الاستخدام:

```javascript
// رفع ملف
const file = document.getElementById('fileInput').files[0];
const result = await window.HSE_SYSTEMS.FileUploadSystem.uploadFile(file);

// النتيجة:
{
  id: "fileId",
  name: "document.pdf",
  size: 2048576,
  type: "application/pdf",
  uploadedAt: "2026-10-27T17:45:00Z",
  uploadedBy: "user123",
  url: "/storage/v1/object/public/documents/documents/fileId"
}

// الحصول على رابط موقع للملف
const signedUrl = await window.HSE_SYSTEMS.FileUploadSystem.getFileUrl(fileId);

// حذف الملف
await window.HSE_SYSTEMS.FileUploadSystem.deleteFile(fileId);
```

---

## 2️⃣ نظام الإشعارات

### المميزات:
- ✅ إشعارات داخل التطبيق
- ✅ إشعارات بريد إلكتروني
- ✅ إشعارات متعددة المستقبلين
- ✅ تتبع حالة القراءة

### الاستخدام:

```javascript
// إرسال إشعار لمستخدم واحد
await window.HSE_SYSTEMS.NotificationSystem.notifyUser(
  userId,
  "عنوان الإشعار",
  "محتوى الرسالة",
  { data: "إضافية" }
);

// إرسال بريد إلكتروني
await window.HSE_SYSTEMS.NotificationSystem.sendEmailNotification(
  "user@hse-swary.app",
  "عنوان البريد",
  "محتوى الرسالة",
  { metadata: "data" }
);

// إرسال لعدة مستخدمين
await window.HSE_SYSTEMS.NotificationSystem.notifyMultiple(
  ["user1", "user2", "user3"],
  "العنوان",
  "الرسالة"
);

// جلب إشعارات المستخدم
const notifications = await window.HSE_SYSTEMS.NotificationSystem.getUserNotifications(userId);

// تحديد كمقروء
await window.HSE_SYSTEMS.NotificationSystem.markAsRead(notificationId);
```

---

## 3️⃣ نظام التوقيعات الرقمية

### المميزات:
- ✅ توقيع رقمي برسم التوقيع
- ✅ تسجيل الوقت والتاريخ
- ✅ تسجيل عنوان IP
- ✅ التحقق من التوقيع

### الاستخدام:

```javascript
// إنشاء توقيع
const signature = await window.HSE_SYSTEMS.SignatureSystem.createSignature(
  documentId,
  signatureImageData, // صورة أو رسم التوقيع
  {
    location: "المكتب الرئيسي",
    notes: "وافق على المستند"
  }
);

// التحقق من التوقيع
const verified = await window.HSE_SYSTEMS.SignatureSystem.verifySignature(signatureId);

// جلب توقيعات المستند
const signatures = await window.HSE_SYSTEMS.SignatureSystem.getDocumentSignatures(documentId);

// النتيجة:
[
  {
    id: "sig-123",
    signer_name: "أحمد محمد",
    timestamp: "2026-10-27T17:45:00Z",
    status: "signed"
  }
]
```

---

## 4️⃣ نظام التصاريح المتقدم

### المميزات:
- ✅ إنشاء تصاريح متعددة المستويات
- ✅ موافقة من أطراف متعددة
- ✅ تمديد التصاريح
- ✅ رفض التصاريح مع أسباب
- ✅ إرفاق مستندات

### الاستخدام:

```javascript
// إنشاء تصريح
const permit = await window.HSE_SYSTEMS.PermitSystem.createPermit({
  title: "تصريح عمل بارتفاع",
  description: "عمل صيانة على الخزان العلوي",
  start_date: "2026-10-27T08:00:00Z",
  end_date: "2026-10-27T16:00:00Z",
  approvers: ["supervisor1", "supervisor2", "manager1"],
  required_approvals: 2
});

// الموافقة على التصريح
await window.HSE_SYSTEMS.PermitSystem.approvePermit(
  permitId,
  approverId,
  "وافقت على التصريح بشروط السلامة المطلوبة"
);

// رفض التصريح
await window.HSE_SYSTEMS.PermitSystem.rejectPermit(
  permitId,
  rejecterId,
  "لم تتوفر الشروط الأساسية للسلامة"
);

// إغلاق التصريح
await window.HSE_SYSTEMS.PermitSystem.closePermit(
  permitId,
  closedByUserId
);

// تمديد التصريح
await window.HSE_SYSTEMS.PermitSystem.extendPermit(
  permitId,
  {
    new_end_date: "2026-10-28T16:00:00Z",
    reason: "عمل لم ينتهِ في الوقت المحدد"
  }
);

// إرفاق ملف للتصريح
await window.HSE_SYSTEMS.PermitSystem.attachDocumentToPermit(
  permitId,
  fileData // من FileUploadSystem
);
```

---

## 5️⃣ نظام التكليفات والمهام

### المميزات:
- ✅ تكليف المهام للموظفين
- ✅ تتبع حالة المهام
- ✅ سجل التغييرات
- ✅ أولويات مختلفة
- ✅ تواريخ استحقاق

### الاستخدام:

```javascript
// إنشاء مهمة
const task = await window.HSE_SYSTEMS.TaskAssignmentSystem.createTask({
  title: "فحص طفاية الحريق",
  description: "فحص شامل لطفايات الحريق في المستودع",
  assigned_to: ["emp001", "emp002"],
  due_date: "2026-10-30",
  priority: "high"
});

// تحديث حالة المهمة
await window.HSE_SYSTEMS.TaskAssignmentSystem.updateTaskStatus(
  taskId,
  "completed", // assigned, in_progress, completed, rejected
  "تم الفحص بنجاح، جميع الطفايات في حالة جيدة"
);

// إرفاق ملف بالمهمة
await window.HSE_SYSTEMS.TaskAssignmentSystem.attachDocumentToTask(
  taskId,
  fileData
);

// جلب مهام المستخدم
const userTasks = await window.HSE_SYSTEMS.TaskAssignmentSystem.getUserTasks(
  userId,
  "in_progress" // optional
);
```

---

## 6️⃣ نظام النماذج والتقارير

### المميزات:
- ✅ حفظ النماذج
- ✅ إرسال للتوقيع
- ✅ توقيع رقمي متعدد
- ✅ معالجة النماذج

### الاستخدام:

```javascript
// حفظ نموذج
const form = await window.HSE_SYSTEMS.FormReportSystem.saveForm({
  title: "نموذج حادث عمل",
  form_type: "incident",
  data: {
    date: "2026-10-27",
    description: "وصف الحادثة",
    witnesses: ["emp001", "emp002"]
  },
  attachments: [fileData1, fileData2]
});

// إرسال النموذج للتوقيع
await window.HSE_SYSTEMS.FormReportSystem.submitFormForApproval(
  formId,
  ["approver1", "approver2"]
);

// توقيع النموذج
await window.HSE_SYSTEMS.FormReportSystem.signForm(
  formId,
  signatureImageData
);
```

---

## 🔗 تكامل الأنظمة

### مثال عملي: تصريح عمل كامل

```javascript
// 1. إنشاء التصريح
const permit = await window.HSE_SYSTEMS.PermitSystem.createPermit({
  title: "صيانة الخط الأول",
  description: "استبدال أنابيب مياه في الخط الأول",
  start_date: new Date().toISOString(),
  end_date: new Date(Date.now() + 24*60*60*1000).toISOString(),
  approvers: ["mgr001", "supervisor001"]
});

// 2. رفع مستندات التصريح
const safetyPlan = await window.HSE_SYSTEMS.FileUploadSystem.uploadFile(planFile);
const permit_updated = await window.HSE_SYSTEMS.PermitSystem.attachDocumentToPermit(
  permit.id,
  safetyPlan
);

// 3. إشعار الأطراف
await window.HSE_SYSTEMS.NotificationSystem.notifyMultiple(
  ["mgr001", "supervisor001", "team001"],
  `تصريح جديد: ${permit.title}`,
  "تم إنشاء تصريح يتطلب موافقتك",
  { permit_id: permit.id }
);

// 4. الموافقة على التصريح
await window.HSE_SYSTEMS.PermitSystem.approvePermit(
  permit.id,
  "mgr001",
  "وافقت"
);

// 5. توقيع التصريح
const signature = await window.HSE_SYSTEMS.SignatureSystem.createSignature(
  permit.id,
  signatureData,
  { location: "المقر الرئيسي" }
);

// 6. إغلاق التصريح بعد الانتهاء
await window.HSE_SYSTEMS.PermitSystem.closePermit(
  permit.id,
  "supervisor001"
);
```

---

## 📱 واجهة المستخدم

### الأقسام المتاحة:

1. **لوحة التحكم** 📊
   - إحصائيات سريعة
   - آخر النشاطات
   - معلومات اليوم

2. **التصاريح** 📋
   - إنشاء تصاريح جديدة
   - جدول التصاريح الحالية
   - إدارة الموافقات

3. **المهام والتكليفات** ✓
   - إنشاء مهام جديدة
   - تعيين المسؤولين
   - تتبع الحالة

4. **النماذج** 📝
   - رفع نماذج حية (صور/PDF)
   - إدارة النماذج المحفوظة
   - إرسال للتوقيع

5. **المستندات** 📂
   - رفع المستندات
   - تنظيم الملفات
   - ربط مع التصاريح

6. **التوقيعات** ✍️
   - رسم التوقيع
   - تسجيل البيانات
   - التحقق من التوقيعات

7. **الإشعارات** 🔔
   - الرسائل غير المقروءة
   - سجل الرسائل
   - الرسائل المؤرشفة

8. **التقارير** 📈
   - إنشاء تقارير
   - تحليل البيانات
   - تصدير التقارير

9. **الإعدادات** ⚙️
   - إعدادات المستخدم
   - تفضيلات الإشعارات
   - الخروج من الحساب

---

## ⚠️ ملاحظات مهمة

1. **الصلاحيات**: تحقق من صلاحيات المستخدم قبل كل عملية
2. **Timestamps**: جميع التواريخ محفوظة بصيغة ISO 8601 (UTC)
3. **التوقيعات**: غير قابلة للتعديل بعد الحفظ
4. **النسخ الاحتياطية**: جميع البيانات مخزنة في Supabase
5. **الأمان**: الملفات محمية برموز توقيع مؤقتة

---

## 🚀 التطبيق العملي

### الخطوة 1: تثبيت الملفات
```bash
1. ضع hse_system_advanced.js في المشروع
2. ضع hse_ui_advanced.html كصفحة رئيسية
3. تأكد من وجود supa.js للاتصال بـ Supabase
```

### الخطوة 2: التهيئة
```javascript
// ستحميل Supabase تلقائياً من supa.js
// جميع الأنظمة متاحة عبر window.HSE_SYSTEMS
```

### الخطوة 3: الاستخدام
```javascript
// استخدم أي نظام من الأنظمة الستة
const result = await window.HSE_SYSTEMS.PermitSystem.createPermit({...});
```

---

## 📊 مخطط البيانات في Supabase

### الجداول الرئيسية:
- `documents` - الملفات والصور
- `notifications` - الإشعارات
- `signatures` - التوقيعات الرقمية
- `permits` - التصاريح
- `tasks` - المهام والتكليفات
- `forms` - النماذج والتقارير

---

## 🔐 الأمان والخصوصية

- ✅ تشفير البيانات في الطريق (HTTPS)
- ✅ التحقق من الهوية عبر JWT
- ✅ RLS (Row Level Security) على قاعدة البيانات
- ✅ الأصول المشفرة مع توقيع موقت
- ✅ سجل كامل للعمليات

---

**تم إنشاد هذا الدليل بتاريخ:** 27 أكتوبر 2026  
**الإصدار:** 5.0  
**الحالة:** ✅ جاهز للاستخدام
