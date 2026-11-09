/**
 * منظومة السلامة HSE v5 - نظم متقدمة
 * رفع الملفات + الإشعارات + التوقيعات + التصاريح + التكليفات
 */

// ============================================================================
// 1️⃣ نظام رفع الملفات والصور (File Upload System)
// ============================================================================

const FileUploadSystem = {
  // رفع صورة أو ملف
  async uploadFile(file, options = {}) {
    try {
      if (!file) throw new Error("لا توجد ملف لرفعه");

      // التحقق من نوع الملف
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowedTypes.includes(file.type)) {
        throw new Error("نوع الملف غير مدعوم. استخدم: صور (JPG/PNG) أو PDF");
      }

      // التحقق من حجم الملف (حد أقصى 10 MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error("حجم الملف أكبر من 10 MB");
      }

      // رفع إلى Supabase Storage
      const fileId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { data, error } = await window.SB.storage
        .from("documents")
        .upload(`documents/${fileId}`, file);

      if (error) throw error;

      return {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        uploadedBy: window.SBA.profile?.id || "unknown",
        url: `/storage/v1/object/public/documents/documents/${fileId}`
      };
    } catch (error) {
      console.error("خطأ في رفع الملف:", error);
      throw error;
    }
  },

  // الحصول على URL موقع للملف
  async getFileUrl(fileId) {
    try {
      const { data, error } = await window.SB.storage
        .from("documents")
        .createSignedUrl(`documents/${fileId}`, 3600); // صالح لمدة ساعة

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error("خطأ في الحصول على رابط الملف:", error);
      throw error;
    }
  },

  // حذف ملف
  async deleteFile(fileId) {
    try {
      const { error } = await window.SB.storage
        .from("documents")
        .remove([`documents/${fileId}`]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("خطأ في حذف الملف:", error);
      throw error;
    }
  }
};

// ============================================================================
// 2️⃣ نظام الإشعارات (Notification System)
// ============================================================================

const NotificationSystem = {
  // إرسال إشعار داخل التطبيق
  async notifyUser(userId, title, message, data = {}) {
    try {
      const { error } = await window.SB
        .from("notifications")
        .insert({
          user_id: userId,
          title,
          message,
          data,
          read: false,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("خطأ في إرسال الإشعار:", error);
      throw error;
    }
  },

  // إرسال إشعار بريد إلكتروني
  async sendEmailNotification(email, title, message, data = {}) {
    try {
      // استخدام Supabase Function أو API خارجي
      const response = await fetch(
        `${window.SB_URL}/functions/v1/send-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${window.SB_KEY}`
          },
          body: JSON.stringify({
            to: email,
            subject: title,
            body: message,
            metadata: data
          })
        }
      );

      if (!response.ok) throw new Error("فشل إرسال البريد");
      return await response.json();
    } catch (error) {
      console.error("خطأ في إرسال البريد:", error);
      throw error;
    }
  },

  // إرسال إشعار متعدد المستقبلين
  async notifyMultiple(userIds, title, message, data = {}) {
    try {
      const notifications = userIds.map(userId => ({
        user_id: userId,
        title,
        message,
        data,
        read: false,
        created_at: new Date().toISOString()
      }));

      const { error } = await window.SB
        .from("notifications")
        .insert(notifications);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("خطأ في إرسال الإشعارات:", error);
      throw error;
    }
  },

  // الحصول على إشعارات المستخدم
  async getUserNotifications(userId, limit = 50) {
    try {
      const { data, error } = await window.SB
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("خطأ في جلب الإشعارات:", error);
      throw error;
    }
  },

  // تحديد إشعار كمقروء
  async markAsRead(notificationId) {
    try {
      const { error } = await window.SB
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("خطأ في تحديث الإشعار:", error);
      throw error;
    }
  }
};

// ============================================================================
// 3️⃣ نظام التوقيعات الرقمية (Digital Signature System)
// ============================================================================

const SignatureSystem = {
  // إنشاء توقيع رقمي
  async createSignature(documentId, signatureData, options = {}) {
    try {
      const signature = {
        id: `sig-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        document_id: documentId,
        signer_id: window.SBA.profile?.id || "unknown",
        signer_name: window.SBA.profile?.username || "unknown",
        signature_data: signatureData, // رسم التوقيع أو صورته
        timestamp: new Date().toISOString(),
        location: options.location || "غير محدد",
        ip_address: await this.getIpAddress(),
        notes: options.notes || "",
        status: "signed"
      };

      const { error } = await window.SB
        .from("signatures")
        .insert(signature);

      if (error) throw error;
      return signature;
    } catch (error) {
      console.error("خطأ في إنشاء التوقيع:", error);
      throw error;
    }
  },

  // التحقق من التوقيع
  async verifySignature(signatureId) {
    try {
      const { data, error } = await window.SB
        .from("signatures")
        .select("*")
        .eq("id", signatureId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("خطأ في التحقق من التوقيع:", error);
      throw error;
    }
  },

  // الحصول على توقيعات المستند
  async getDocumentSignatures(documentId) {
    try {
      const { data, error } = await window.SB
        .from("signatures")
        .select("*")
        .eq("document_id", documentId)
        .order("timestamp", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("خطأ في جلب التوقيعات:", error);
      throw error;
    }
  },

  // الحصول على عنوان IP
  async getIpAddress() {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      return data.ip || "unknown";
    } catch (error) {
      return "unknown";
    }
  }
};

// ============================================================================
// 4️⃣ نظام التصاريح المتقدم (Advanced Permits System)
// ============================================================================

const PermitSystem = {
  // إنشاء تصريح جديد
  async createPermit(permitData) {
    try {
      const permit = {
        id: `permit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ...permitData,
        status: "pending", // pending, approved, rejected, closed
        created_by: window.SBA.profile?.id || "unknown",
        created_at: new Date().toISOString(),
        approvals: [], // قائمة بالموافقات من الأطراف
        signatures: [], // قائمة بالتوقيعات
        documents: [] // الملفات المرفقة
      };

      const { error } = await window.SB
        .from("permits")
        .insert(permit);

      if (error) throw error;

      // إرسال إشعارات للأطراف المعنية
      await NotificationSystem.notifyMultiple(
        permitData.approvers || [],
        `تصريح جديد: ${permitData.title}`,
        `تم إنشاء تصريح جديد يتطلب موافقتك: ${permitData.description}`,
        { permit_id: permit.id }
      );

      return permit;
    } catch (error) {
      console.error("خطأ في إنشاء التصريح:", error);
      throw error;
    }
  },

  // الموافقة على التصريح
  async approvePermit(permitId, approverId, notes = "") {
    try {
      // جلب التصريح الحالي
      const { data: permit, error: fetchError } = await window.SB
        .from("permits")
        .select("*")
        .eq("id", permitId)
        .single();

      if (fetchError) throw fetchError;

      // إضافة الموافقة
      const approvals = permit.approvals || [];
      approvals.push({
        approver_id: approverId,
        status: "approved",
        timestamp: new Date().toISOString(),
        notes
      });

      // تحديث التصريح
      const { error: updateError } = await window.SB
        .from("permits")
        .update({
          approvals,
          status: approvals.length === (permit.required_approvals || 1) ? "approved" : "pending"
        })
        .eq("id", permitId);

      if (updateError) throw updateError;

      // إرسال إشعار بالموافقة
      await NotificationSystem.notifyUser(
        permit.created_by,
        "تم الموافقة على التصريح",
        `تمت الموافقة على التصريح ${permitId} من قبل ${approverId}`,
        { permit_id: permitId }
      );

      return true;
    } catch (error) {
      console.error("خطأ في الموافقة على التصريح:", error);
      throw error;
    }
  },

  // رفض التصريح
  async rejectPermit(permitId, rejecterId, reason = "") {
    try {
      const { error } = await window.SB
        .from("permits")
        .update({
          status: "rejected",
          rejection_reason: reason,
          rejected_by: rejecterId,
          rejected_at: new Date().toISOString()
        })
        .eq("id", permitId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("خطأ في رفض التصريح:", error);
      throw error;
    }
  },

  // إغلاق التصريح
  async closePermit(permitId, closedBy, closedAt = new Date().toISOString()) {
    try {
      const { error } = await window.SB
        .from("permits")
        .update({
          status: "closed",
          closed_by: closedBy,
          closed_at: closedAt
        })
        .eq("id", permitId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("خطأ في إغلاق التصريح:", error);
      throw error;
    }
  },

  // تمديد التصريح
  async extendPermit(permitId, extensionData) {
    try {
      const { data: permit, error: fetchError } = await window.SB
        .from("permits")
        .select("*")
        .eq("id", permitId)
        .single();

      if (fetchError) throw fetchError;

      const extensions = permit.extensions || [];
      extensions.push({
        requested_by: window.SBA.profile?.id,
        requested_at: new Date().toISOString(),
        new_end_date: extensionData.new_end_date,
        reason: extensionData.reason,
        status: "pending"
      });

      const { error: updateError } = await window.SB
        .from("permits")
        .update({ extensions })
        .eq("id", permitId);

      if (updateError) throw updateError;
      return true;
    } catch (error) {
      console.error("خطأ في تمديد التصريح:", error);
      throw error;
    }
  },

  // إضافة ملف للتصريح
  async attachDocumentToPermit(permitId, fileData) {
    try {
      const { data: permit, error: fetchError } = await window.SB
        .from("permits")
        .select("*")
        .eq("id", permitId)
        .single();

      if (fetchError) throw fetchError;

      const documents = permit.documents || [];
      documents.push({
        file_id: fileData.id,
        file_name: fileData.name,
        uploaded_by: window.SBA.profile?.id,
        uploaded_at: new Date().toISOString()
      });

      const { error: updateError } = await window.SB
        .from("permits")
        .update({ documents })
        .eq("id", permitId);

      if (updateError) throw updateError;
      return true;
    } catch (error) {
      console.error("خطأ في إرفاق الملف:", error);
      throw error;
    }
  }
};

// ============================================================================
// 5️⃣ نظام التكليفات والمهام (Task Assignment System)
// ============================================================================

const TaskAssignmentSystem = {
  // إنشاء مهمة/تكليف
  async createTask(taskData) {
    try {
      const task = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ...taskData,
        status: "assigned", // assigned, in_progress, completed, rejected
        created_by: window.SBA.profile?.id,
        assigned_to: taskData.assigned_to || [],
        created_at: new Date().toISOString(),
        due_date: taskData.due_date,
        priority: taskData.priority || "normal", // low, normal, high, critical
        attachments: [],
        history: []
      };

      const { error } = await window.SB
        .from("tasks")
        .insert(task);

      if (error) throw error;

      // إرسال إشعارات للمكلفين
      await NotificationSystem.notifyMultiple(
        task.assigned_to,
        `مهمة جديدة: ${task.title}`,
        task.description || "تم تعيين مهمة جديدة لك",
        { task_id: task.id }
      );

      return task;
    } catch (error) {
      console.error("خطأ في إنشاء المهمة:", error);
      throw error;
    }
  },

  // تحديث حالة المهمة
  async updateTaskStatus(taskId, newStatus, notes = "") {
    try {
      const { data: task, error: fetchError } = await window.SB
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .single();

      if (fetchError) throw fetchError;

      const history = task.history || [];
      history.push({
        status_change: `${task.status} → ${newStatus}`,
        changed_by: window.SBA.profile?.id,
        changed_at: new Date().toISOString(),
        notes
      });

      const { error: updateError } = await window.SB
        .from("tasks")
        .update({
          status: newStatus,
          history,
          completed_at: newStatus === "completed" ? new Date().toISOString() : task.completed_at
        })
        .eq("id", taskId);

      if (updateError) throw updateError;

      // إرسال إشعار لمنشئ المهمة
      await NotificationSystem.notifyUser(
        task.created_by,
        `تحديث المهمة: ${task.title}`,
        `تم تحديث حالة المهمة إلى: ${newStatus}`,
        { task_id: taskId }
      );

      return true;
    } catch (error) {
      console.error("خطأ في تحديث المهمة:", error);
      throw error;
    }
  },

  // إضافة ملف للمهمة
  async attachDocumentToTask(taskId, fileData) {
    try {
      const { data: task, error: fetchError } = await window.SB
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .single();

      if (fetchError) throw fetchError;

      const attachments = task.attachments || [];
      attachments.push({
        file_id: fileData.id,
        file_name: fileData.name,
        uploaded_by: window.SBA.profile?.id,
        uploaded_at: new Date().toISOString()
      });

      const { error: updateError } = await window.SB
        .from("tasks")
        .update({ attachments })
        .eq("id", taskId);

      if (updateError) throw updateError;
      return true;
    } catch (error) {
      console.error("خطأ في إرفاق الملف:", error);
      throw error;
    }
  },

  // الحصول على مهام المستخدم
  async getUserTasks(userId, status = null) {
    try {
      let query = window.SB
        .from("tasks")
        .select("*")
        .contains("assigned_to", [userId]);

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("خطأ في جلب المهام:", error);
      throw error;
    }
  }
};

// ============================================================================
// 6️⃣ نظام النماذج والتقارير (Forms & Reports)
// ============================================================================

const FormReportSystem = {
  // حفظ نموذج
  async saveForm(formData) {
    try {
      const form = {
        id: `form-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ...formData,
        saved_by: window.SBA.profile?.id,
        saved_at: new Date().toISOString(),
        status: "draft", // draft, submitted, approved, archived
        signatures: [],
        attachments: formData.attachments || []
      };

      const { error } = await window.SB
        .from("forms")
        .insert(form);

      if (error) throw error;
      return form;
    } catch (error) {
      console.error("خطأ في حفظ النموذج:", error);
      throw error;
    }
  },

  // إرسال نموذج للتوقيع
  async submitFormForApproval(formId, approversIds) {
    try {
      const { data: form, error: fetchError } = await window.SB
        .from("forms")
        .select("*")
        .eq("id", formId)
        .single();

      if (fetchError) throw fetchError;

      const { error: updateError } = await window.SB
        .from("forms")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
          approvers: approversIds
        })
        .eq("id", formId);

      if (updateError) throw updateError;

      // إرسال إشعارات للموافقين
      await NotificationSystem.notifyMultiple(
        approversIds,
        `نموذج يحتاج الموافقة: ${form.title}`,
        "تم إرسال نموذج لك للمراجعة والتوقيع",
        { form_id: formId }
      );

      return true;
    } catch (error) {
      console.error("خطأ في إرسال النموذج:", error);
      throw error;
    }
  },

  // توقيع نموذج
  async signForm(formId, signatureData) {
    try {
      // إنشاء توقيع
      const signature = await SignatureSystem.createSignature(formId, signatureData);

      // تحديث النموذج
      const { data: form, error: fetchError } = await window.SB
        .from("forms")
        .select("*")
        .eq("id", formId)
        .single();

      if (fetchError) throw fetchError;

      const signatures = form.signatures || [];
      signatures.push(signature.id);

      const { error: updateError } = await window.SB
        .from("forms")
        .update({
          signatures,
          status: signatures.length === (form.required_signatures || 1) ? "approved" : "submitted"
        })
        .eq("id", formId);

      if (updateError) throw updateError;
      return true;
    } catch (error) {
      console.error("خطأ في توقيع النموذج:", error);
      throw error;
    }
  }
};

// ============================================================================
// تصدير جميع الأنظمة
// ============================================================================

window.HSE_SYSTEMS = {
  FileUploadSystem,
  NotificationSystem,
  SignatureSystem,
  PermitSystem,
  TaskAssignmentSystem,
  FormReportSystem
};

console.log("✅ تم تحميل أنظمة HSE المتقدمة");
