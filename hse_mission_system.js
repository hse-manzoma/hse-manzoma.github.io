/**
 * نظام المأموريات المتقدم - منظومة السلامة HSE v5
 * مأمورية فردي (موظف واحد) + مأمورية مجمع (مجموعة)
 */

const MissionSystem = {
  // ============================================================================
  // 1️⃣ إنشاء مأمورية فردي (موظف واحد)
  // ============================================================================

  async createIndividualMission(missionData) {
    try {
      if (!missionData.employee_id) {
        throw new Error("المأمورية الفردية تتطلب موظف واحد فقط");
      }

      const mission = {
        id: `mission-ind-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: "individual", // فردي

        // بيانات المأمورية
        title: missionData.title || "",
        description: missionData.description || "",
        purpose: missionData.purpose || "",

        // الموظف الواحد فقط
        employee_id: missionData.employee_id,
        employee_name: missionData.employee_name || "",
        employee_code: missionData.employee_code || "",

        // الجهة والموقع
        destination: missionData.destination || "",
        department: missionData.department || "",

        // التواريخ والأوقات
        start_date: missionData.start_date,
        end_date: missionData.end_date,
        start_time: missionData.start_time,
        end_time: missionData.end_time,

        // الحالة
        status: "pending", // pending, approved, rejected, completed, cancelled

        // البيانات الإدارية
        created_by: window.SBA.profile?.id || "unknown",
        created_at: new Date().toISOString(),

        // الموافقات والتوقيعات
        approvals: [], // قائمة الموافقات
        signatures: [], // قائمة التوقيعات

        // المرفقات
        attachments: missionData.attachments || [],

        // نموذج GIECO
        gieco_form: {
          department_manager_approval: false,
          hr_approval: false,
          employee_signature: false,
          return_date: null,
          actual_return_time: null
        },

        // ملاحظات إضافية
        notes: missionData.notes || "",
        data: missionData.data || {}
      };

      // حفظ في قاعدة البيانات
      const { error } = await window.SB
        .from("missions_individual")
        .insert(mission);

      if (error) throw error;

      // إرسال إشعارات
      await this.notifyApprovers(mission);

      return mission;
    } catch (error) {
      console.error("خطأ في إنشاء مأمورية فردي:", error);
      throw error;
    }
  },

  // ============================================================================
  // 2️⃣ إنشاء مأمورية مجمع (مجموعة موظفين)
  // ============================================================================

  async createGroupMission(missionData) {
    try {
      if (!missionData.employees || missionData.employees.length < 2) {
        throw new Error("المأمورية الجماعية تتطلب موظفين اثنين على الأقل");
      }

      const mission = {
        id: `mission-grp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: "group", // مجمع

        // بيانات المأمورية
        title: missionData.title || "",
        description: missionData.description || "",
        purpose: missionData.purpose || "",

        // الموظفون (مجموعة)
        employees: missionData.employees.map(emp => ({
          id: emp.id,
          name: emp.name,
          code: emp.code,
          role: emp.role || "member",
          status: "pending" // pending, approved, signed
        })),

        // قائد المجموعة
        group_leader_id: missionData.group_leader_id,
        group_leader_name: missionData.group_leader_name || "",

        // الجهة والموقع
        destination: missionData.destination || "",
        department: missionData.department || "",

        // التواريخ والأوقات
        start_date: missionData.start_date,
        end_date: missionData.end_date,
        start_time: missionData.start_time,
        end_time: missionData.end_time,

        // الحالة
        status: "pending", // pending, approved, in_progress, completed, cancelled

        // البيانات الإدارية
        created_by: window.SBA.profile?.id || "unknown",
        created_at: new Date().toISOString(),

        // الموافقات (لكل موظف)
        approvals: [], // قائمة موافقات كل موظف
        signatures: [], // قائمة توقيعات كل موظف

        // المرفقات
        attachments: missionData.attachments || [],

        // نموذج GIECO للمجموعة
        gieco_form: {
          department_manager_approval: false,
          hr_approval: false,
          group_leader_signature: false,
          planned_return_date: missionData.end_date,
          actual_return_date: null,
          attendance_sheet: []
        },

        // ملاحظات
        notes: missionData.notes || "",
        data: missionData.data || {}
      };

      // حفظ في قاعدة البيانات
      const { error } = await window.SB
        .from("missions_group")
        .insert(mission);

      if (error) throw error;

      // إرسال إشعارات لجميع الموظفين
      await this.notifyGroupMembers(mission);

      return mission;
    } catch (error) {
      console.error("خطأ في إنشاء مأمورية مجمع:", error);
      throw error;
    }
  },

  // ============================================================================
  // 3️⃣ الموافقة على المأمورية
  // ============================================================================

  async approveMission(missionId, missionType, approverId, approverName, notes = "") {
    try {
      const table = missionType === "individual" ? "missions_individual" : "missions_group";

      const { data: mission, error: fetchError } = await window.SB
        .from(table)
        .select("*")
        .eq("id", missionId)
        .single();

      if (fetchError) throw fetchError;

      // إضافة موافقة جديدة
      const approvals = mission.approvals || [];
      approvals.push({
        approver_id: approverId,
        approver_name: approverName,
        status: "approved",
        timestamp: new Date().toISOString(),
        notes
      });

      // تحديث الحالة
      const { error: updateError } = await window.SB
        .from(table)
        .update({
          approvals,
          status: "approved"
        })
        .eq("id", missionId);

      if (updateError) throw updateError;

      // إرسال إشعار
      await NotificationSystem.notifyUser(
        mission.created_by,
        `تمت الموافقة على المأمورية: ${mission.title}`,
        `وافق عليها: ${approverName}`,
        { mission_id: missionId, type: missionType }
      );

      return true;
    } catch (error) {
      console.error("خطأ في الموافقة على المأمورية:", error);
      throw error;
    }
  },

  // ============================================================================
  // 4️⃣ توقيع المأمورية
  // ============================================================================

  async signMission(missionId, missionType, employeeId, signatureData) {
    try {
      const table = missionType === "individual" ? "missions_individual" : "missions_group";

      const { data: mission, error: fetchError } = await window.SB
        .from(table)
        .select("*")
        .eq("id", missionId)
        .single();

      if (fetchError) throw fetchError;

      // إنشاء توقيع
      const signature = await SignatureSystem.createSignature(
        missionId,
        signatureData,
        { location: "مكتب الموارد البشرية" }
      );

      // إضافة التوقيع
      const signatures = mission.signatures || [];
      signatures.push(signature.id);

      // تحديث الحالة
      const { error: updateError } = await window.SB
        .from(table)
        .update({
          signatures,
          status: signatures.length >= 2 ? "signed" : "pending"
        })
        .eq("id", missionId);

      if (updateError) throw updateError;

      return signature;
    } catch (error) {
      console.error("خطأ في توقيع المأمورية:", error);
      throw error;
    }
  },

  // ============================================================================
  // 5️⃣ إنهاء المأمورية
  // ============================================================================

  async completeMission(missionId, missionType, completedData = {}) {
    try {
      const table = missionType === "individual" ? "missions_individual" : "missions_group";

      const { error } = await window.SB
        .from(table)
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          actual_return_time: completedData.return_time,
          completion_notes: completedData.notes || "",
          completed_by: window.SBA.profile?.id
        })
        .eq("id", missionId);

      if (error) throw error;

      // إرسال إشعار
      const { data: mission } = await window.SB
        .from(table)
        .select("title, created_by")
        .eq("id", missionId)
        .single();

      if (mission) {
        await NotificationSystem.notifyUser(
          mission.created_by,
          `تم إنهاء المأمورية: ${mission.title}`,
          `تمت المأمورية بنجاح`,
          { mission_id: missionId }
        );
      }

      return true;
    } catch (error) {
      console.error("خطأ في إنهاء المأمورية:", error);
      throw error;
    }
  },

  // ============================================================================
  // 6️⃣ إرسال الإشعارات
  // ============================================================================

  async notifyApprovers(mission) {
    try {
      const approvers = [
        mission.created_by,
        // إضافة مديري الموافقة
      ];

      await NotificationSystem.notifyMultiple(
        approvers,
        `مأمورية جديدة: ${mission.title}`,
        `تم طلب مأمورية فردية للموظف: ${mission.employee_name}`,
        { mission_id: mission.id, type: "individual" }
      );
    } catch (error) {
      console.error("خطأ في إرسال الإشعارات:", error);
    }
  },

  async notifyGroupMembers(mission) {
    try {
      const memberIds = mission.employees.map(emp => emp.id);

      await NotificationSystem.notifyMultiple(
        memberIds,
        `مأمورية مجموعة: ${mission.title}`,
        `تم تعيينك في مأمورية مجموعة برئاسة: ${mission.group_leader_name}`,
        { mission_id: mission.id, type: "group" }
      );

      // إشعار لمدير المجموعة
      await NotificationSystem.notifyUser(
        mission.group_leader_id,
        `أنت مدير المأمورية: ${mission.title}`,
        `تم تعيينك مدير مجموعة بـ ${mission.employees.length} موظفين`,
        { mission_id: mission.id, type: "group" }
      );
    } catch (error) {
      console.error("خطأ في إرسال إشعارات المجموعة:", error);
    }
  },

  // ============================================================================
  // 7️⃣ جلب المأموريات
  // ============================================================================

  async getUserMissions(userId, status = null) {
    try {
      let query = window.SB
        .from("missions_individual")
        .select("*")
        .or(`created_by.eq.${userId},employee_id.eq.${userId}`);

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("خطأ في جلب المأموريات:", error);
      throw error;
    }
  },

  async getGroupMissions(userId) {
    try {
      const { data, error } = await window.SB
        .from("missions_group")
        .select("*")
        .or(`group_leader_id.eq.${userId},created_by.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("خطأ في جلب المأموريات الجماعية:", error);
      throw error;
    }
  },

  // ============================================================================
  // 8️⃣ نموذج GIECO
  // ============================================================================

  async updateGIECOForm(missionId, missionType, formData) {
    try {
      const table = missionType === "individual" ? "missions_individual" : "missions_group";

      const { error } = await window.SB
        .from(table)
        .update({
          gieco_form: formData
        })
        .eq("id", missionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("خطأ في تحديث نموذج GIECO:", error);
      throw error;
    }
  }
};

// تصدير النظام
window.HSE_SYSTEMS.MissionSystem = MissionSystem;

console.log("✅ تم تحميل نظام المأموريات المتقدم");
