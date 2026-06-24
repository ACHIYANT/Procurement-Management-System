const { Op } = require("sequelize");
const {
  Firm,
  ProcurementEmployee,
  Indent,
  IndentItem,
  ProcurementCase,
  ProcurementCaseItem,
  Tender,
  TenderVendor,
  TenderEmdEntry,
  PurchaseOrder,
  PurchaseOrderPayment,
  PbgEntry,
  Empanelment,
  EmpanelmentItemCategory,
  Firm: FirmModel,
} = require("../../models");

class DashboardRepository {
  parseRoles(roles) {
    if (Array.isArray(roles)) return roles;
    return String(roles || "")
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);
  }

  normalizeRole(role) {
    return String(role || "")
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_")
      .replace(/_+/g, "_");
  }

  isAdminRole(roles = []) {
    const roleSet = new Set(this.parseRoles(roles).map((role) => this.normalizeRole(role)));
    return roleSet.has("ADMIN") || roleSet.has("SUPER_ADMIN");
  }

  falseWhere() {
    return { id: { [Op.in]: [-1] } };
  }

  idWhere(ids = []) {
    return { id: { [Op.in]: Array.isArray(ids) && ids.length ? ids : [-1] } };
  }

  inWhere(field, ids = []) {
    return Array.isArray(ids) && ids.length ? { [field]: { [Op.in]: ids } } : null;
  }

  andWhere(...parts) {
    const filtered = parts.filter(Boolean);
    if (!filtered.length) return undefined;
    if (filtered.length === 1) return filtered[0];
    return { [Op.and]: filtered };
  }

  orWhere(parts = []) {
    const filtered = parts.filter(Boolean);
    if (!filtered.length) return this.falseWhere();
    if (filtered.length === 1) return filtered[0];
    return { [Op.or]: filtered };
  }

  scopeWhere(scopeIds, key) {
    if (!scopeIds) return undefined;
    return this.idWhere(scopeIds[key] || []);
  }

  emdScopeWhere(scopeIds) {
    if (!scopeIds) return undefined;
    return this.orWhere([
      this.inWhere("tender_id", scopeIds.tenderIds),
      this.inWhere("created_by", scopeIds.employeeIds),
      this.inWhere("updated_by", scopeIds.employeeIds),
    ]);
  }

  pbgScopeWhere(scopeIds) {
    if (!scopeIds) return undefined;
    return this.orWhere([
      this.inWhere("tender_id", scopeIds.tenderIds),
      this.inWhere("po_id", scopeIds.poIds),
      this.inWhere("created_by", scopeIds.employeeIds),
      this.inWhere("updated_by", scopeIds.employeeIds),
    ]);
  }

  async resolveDashboardScope(query = {}) {
    const roles = this.parseRoles(query.roles || query.actor_roles);
    if (!roles.length && !query.empcode && !query.employee_id) return null;
    if (this.isAdminRole(roles)) return null;

    const employeeId = Number(query.employee_id || 0);
    const empcode = String(query.empcode || "").trim();
    const employee = employeeId
      ? await ProcurementEmployee.findByPk(employeeId, { attributes: ["id"] })
      : empcode
        ? await ProcurementEmployee.findOne({
            where: { empcode },
            attributes: ["id"],
          })
        : null;

    if (!employee) {
      return {
        employeeIds: [],
        indentIds: [],
        indentItemIds: [],
        caseIds: [],
        tenderIds: [],
        poIds: [],
      };
    }

    return this.buildScopedEntityIds(Number(employee.id));
  }

  async buildScopedEntityIds(employeeId) {
    const employeeIds = [employeeId];
    const indentIds = new Set();
    const indentItemIds = new Set();
    const caseIds = new Set();
    const tenderIds = new Set();
    const poIds = new Set();

    const [ownedIndents, ownedItems, createdCaseItems, paymentRows] = await Promise.all([
      Indent.findAll({
        where: this.orWhere([
          { created_by: employeeId },
          { updated_by: employeeId },
        ]),
        attributes: ["id"],
      }),
      IndentItem.findAll({
        where: this.orWhere([
          { created_by: employeeId },
          { updated_by: employeeId },
          { assigned_procurement_officer_id: employeeId },
          { estimated_by_procurement_officer_id: employeeId },
        ]),
        attributes: ["id", "indent_id"],
      }),
      ProcurementCaseItem.findAll({
        where: this.orWhere([
          { created_by: employeeId },
          { updated_by: employeeId },
        ]),
        attributes: ["procurement_case_id", "indent_item_id"],
      }),
      PurchaseOrderPayment.findAll({
        where: this.orWhere([
          { created_by: employeeId },
          { updated_by: employeeId },
        ]),
        attributes: ["po_id"],
      }),
    ]);

    ownedIndents.forEach((row) => indentIds.add(Number(row.id)));
    ownedItems.forEach((row) => {
      indentItemIds.add(Number(row.id));
      if (row.indent_id) indentIds.add(Number(row.indent_id));
    });
    createdCaseItems.forEach((row) => {
      if (row.procurement_case_id) caseIds.add(Number(row.procurement_case_id));
      if (row.indent_item_id) indentItemIds.add(Number(row.indent_item_id));
    });
    paymentRows.forEach((row) => {
      if (row.po_id) poIds.add(Number(row.po_id));
    });

    const indentLinkedItems = await IndentItem.findAll({
      where: this.inWhere("indent_id", Array.from(indentIds)) || this.falseWhere(),
      attributes: ["id", "indent_id"],
    });
    indentLinkedItems.forEach((row) => {
      indentItemIds.add(Number(row.id));
      if (row.indent_id) indentIds.add(Number(row.indent_id));
    });

    const linkedCaseItems = await ProcurementCaseItem.findAll({
      where: this.inWhere("indent_item_id", Array.from(indentItemIds)) || this.falseWhere(),
      attributes: ["procurement_case_id"],
    });
    linkedCaseItems.forEach((row) => {
      if (row.procurement_case_id) caseIds.add(Number(row.procurement_case_id));
    });

    const cases = await ProcurementCase.findAll({
      where: this.orWhere([
        { created_by: employeeId },
        { updated_by: employeeId },
        { procurement_officer_id: employeeId },
        this.inWhere("indent_id", Array.from(indentIds)),
        this.inWhere("id", Array.from(caseIds)),
      ]),
      attributes: ["id", "indent_id"],
    });
    cases.forEach((row) => {
      caseIds.add(Number(row.id));
      if (row.indent_id) indentIds.add(Number(row.indent_id));
    });

    const tenders = await Tender.findAll({
      where: this.orWhere([
        { created_by: employeeId },
        { updated_by: employeeId },
        this.inWhere("procurement_case_id", Array.from(caseIds)),
      ]),
      attributes: ["id", "procurement_case_id"],
    });
    tenders.forEach((row) => {
      tenderIds.add(Number(row.id));
      if (row.procurement_case_id) caseIds.add(Number(row.procurement_case_id));
    });

    const purchaseOrders = await PurchaseOrder.findAll({
      where: this.orWhere([
        { created_by: employeeId },
        { updated_by: employeeId },
        this.inWhere("tender_id", Array.from(tenderIds)),
        this.inWhere("id", Array.from(poIds)),
      ]),
      attributes: ["id", "tender_id"],
    });
    purchaseOrders.forEach((row) => {
      poIds.add(Number(row.id));
      if (row.tender_id) tenderIds.add(Number(row.tender_id));
    });

    return {
      employeeIds,
      indentIds: Array.from(indentIds),
      indentItemIds: Array.from(indentItemIds),
      caseIds: Array.from(caseIds),
      tenderIds: Array.from(tenderIds),
      poIds: Array.from(poIds),
    };
  }

  async getValueMetrics(scopeIds = null) {
    const [
      indentItems,
      procurementCases,
      tenders,
      purchaseOrders,
      emdEntries,
      pbgEntries,
    ] = await Promise.all([
      IndentItem.findAll({
        where: this.scopeWhere(scopeIds, "indentItemIds"),
        attributes: ["estimated_amount"],
      }),
      ProcurementCase.findAll({
        where: this.scopeWhere(scopeIds, "caseIds"),
        attributes: ["estimated_value"],
      }),
      Tender.findAll({
        where: this.scopeWhere(scopeIds, "tenderIds"),
        attributes: ["tender_value", "emd_amount", "tender_fee_amount"],
      }),
      PurchaseOrder.findAll({
        where: this.scopeWhere(scopeIds, "poIds"),
        attributes: ["po_value", "required_pbg_amount"],
      }),
      TenderEmdEntry.findAll({
        where: this.emdScopeWhere(scopeIds),
        attributes: ["emd_amount", "tender_fee_amount"],
      }),
      PbgEntry.findAll({
        where: this.pbgScopeWhere(scopeIds),
        attributes: ["pbg_amount"],
      }),
    ]);

    const sum = (rows, key) =>
      (Array.isArray(rows) ? rows : []).reduce((total, row) => total + Number(row?.[key] || 0), 0);

    return {
      indent_estimated_amount: sum(indentItems, "estimated_amount"),
      procurement_case_estimated_value: sum(procurementCases, "estimated_value"),
      tender_value: sum(tenders, "tender_value"),
      tender_declared_emd_value: sum(tenders, "emd_amount"),
      tender_declared_fee_value: sum(tenders, "tender_fee_amount"),
      purchase_order_value: sum(purchaseOrders, "po_value"),
      required_pbg_value: sum(purchaseOrders, "required_pbg_amount"),
      emd_recorded_value: sum(emdEntries, "emd_amount"),
      emd_fee_recorded_value: sum(emdEntries, "tender_fee_amount"),
      pbg_recorded_value: sum(pbgEntries, "pbg_amount"),
    };
  }

  async getOverviewCounts(scopeIds = null) {
    const [
      firms,
      activeFirms,
      employees,
      activeEmployees,
      indents,
      cases,
      tenders,
      purchaseOrders,
      emdEntries,
      pbgEntries,
      empanelments,
    ] = await Promise.all([
      Firm.count(),
      Firm.count({ where: { is_active: true } }),
      ProcurementEmployee.count(),
      ProcurementEmployee.count({ where: { is_active: true } }),
      Indent.count({ where: this.scopeWhere(scopeIds, "indentIds") }),
      ProcurementCase.count({ where: this.scopeWhere(scopeIds, "caseIds") }),
      Tender.count({ where: this.scopeWhere(scopeIds, "tenderIds") }),
      PurchaseOrder.count({ where: this.scopeWhere(scopeIds, "poIds") }),
      TenderEmdEntry.count({ where: this.emdScopeWhere(scopeIds) }),
      PbgEntry.count({ where: this.pbgScopeWhere(scopeIds) }),
      scopeIds ? 0 : Empanelment.count(),
    ]);

    return {
      firms,
      active_firms: activeFirms,
      employees,
      active_employees: activeEmployees,
      indents,
      procurement_cases: cases,
      tenders,
      purchase_orders: purchaseOrders,
      emd_entries: emdEntries,
      pbg_entries: pbgEntries,
      empanelments,
    };
  }

  async getIndentMetrics(scopeIds = null) {
    const indentItemScope = this.scopeWhere(scopeIds, "indentItemIds");
    const indentScope = this.scopeWhere(scopeIds, "indentIds");
    const [
      unassignedItems,
      itemsWithoutEstimate,
      adminApprovalItems,
      activeIndents,
    ] = await Promise.all([
      IndentItem.count({
        where: this.andWhere(indentItemScope, {
          [Op.or]: [
            { assigned_procurement_officer_id: null },
            { assignment_status: "unassigned" },
          ],
        }),
      }),
      IndentItem.count({
        where: this.andWhere(indentItemScope, {
          [Op.or]: [{ estimated_amount: null }, { estimated_rate: null }],
        }),
      }),
      IndentItem.count({
        where: this.andWhere(indentItemScope, { administrative_approval_required: true }),
      }),
      Indent.count({
        where: this.andWhere(indentScope, {
          status: {
            [Op.notIn]: ["closed", "cancelled", "completed"],
          },
        }),
      }),
    ]);

    return {
      active_indents: activeIndents,
      unassigned_items: unassignedItems,
      items_without_estimate: itemsWithoutEstimate,
      items_requiring_admin_approval: adminApprovalItems,
    };
  }

  async getProcurementCaseMetrics(scopeIds = null) {
    const tenderModes = ["tender_gem", "tender_nic", "tender_split"];
    const caseScope = this.scopeWhere(scopeIds, "caseIds");
    const [casesWithoutOfficer, tenderModeCases] = await Promise.all([
      ProcurementCase.count({
        where: this.andWhere(caseScope, {
          [Op.or]: [{ procurement_officer_id: null }, { procurement_officer_id: { [Op.is]: null } }],
        }),
      }),
      ProcurementCase.findAll({
        where: this.andWhere(caseScope, { procurement_mode: { [Op.in]: tenderModes } }),
        include: [
          {
            model: Tender,
            as: "tenders",
            attributes: ["id"],
            required: false,
          },
        ],
      }),
    ]);

    const tenderModeCasesWithoutTender = tenderModeCases.filter(
      (row) => !Array.isArray(row.tenders) || row.tenders.length === 0,
    ).length;

    return {
      cases_without_procurement_officer: casesWithoutOfficer,
      tender_mode_cases_without_tender: tenderModeCasesWithoutTender,
    };
  }

  async getTenderAttentionMetrics(scopeIds = null) {
    const tenders = await Tender.findAll({
      where: this.scopeWhere(scopeIds, "tenderIds"),
      include: [
        {
          model: TenderVendor,
          as: "vendors",
          required: false,
          include: [{ model: TenderEmdEntry, as: "emd_entry", required: false }],
        },
        {
          model: PurchaseOrder,
          as: "purchase_orders",
          required: false,
          include: [{ model: PbgEntry, as: "pbg_entries", required: false }],
        },
      ],
      order: [["id", "DESC"]],
    });

    const metrics = {
      no_vendor_linked: 0,
      emd_attention_required: 0,
      pbg_attention_required: 0,
      overdue_submission_deadlines: 0,
      with_issue: 0,
    };

    const today = new Date();

    for (const tender of tenders) {
      const vendors = Array.isArray(tender.vendors) ? tender.vendors : [];
      const purchaseOrders = Array.isArray(tender.purchase_orders) ? tender.purchase_orders : [];

      if (vendors.length === 0) {
        metrics.no_vendor_linked += 1;
      }

      const missingEmdRecord = vendors.some((vendor) => !vendor.emd_entry);
      const emdPending = vendors.some((vendor) => {
        const entry = vendor.emd_entry;
        if (!entry) return false;
        return ["not_submitted", "pending"].includes(String(entry.emd_submission_status || "").toLowerCase());
      });

      const pbgIssue = purchaseOrders.some((purchaseOrder) => {
        const entries = Array.isArray(purchaseOrder.pbg_entries) ? purchaseOrder.pbg_entries : [];
        const totalPbg = entries.reduce((sum, item) => sum + Number(item.pbg_amount || 0), 0);
        const required = Number(purchaseOrder.required_pbg_amount || 0);
        return entries.length === 0 || (required > 0 && totalPbg < required);
      });

      const deadlineOverdue =
        tender.current_submission_deadline &&
        new Date(tender.current_submission_deadline).getTime() < today.getTime() &&
        !["closed", "cancelled", "awarded"].includes(String(tender.status || "").toLowerCase());

      if (missingEmdRecord || emdPending) metrics.emd_attention_required += 1;
      if (pbgIssue) metrics.pbg_attention_required += 1;
      if (deadlineOverdue) metrics.overdue_submission_deadlines += 1;
      if (missingEmdRecord || emdPending || pbgIssue || deadlineOverdue) metrics.with_issue += 1;
    }

    return metrics;
  }

  async getEmdMetrics(scopeIds = null) {
    const emdScope = this.emdScopeWhere(scopeIds);
    const [pendingRefunds, notSubmitted, exempted, transferredToHartron] = await Promise.all([
      TenderEmdEntry.count({ where: this.andWhere(emdScope, { refund_status: "pending" }) }),
      TenderEmdEntry.count({ where: this.andWhere(emdScope, { emd_submission_status: "not_submitted" }) }),
      TenderEmdEntry.count({ where: this.andWhere(emdScope, { emd_submission_status: "exempted" }) }),
      TenderEmdEntry.count({ where: this.andWhere(emdScope, { emd_submission_status: "transferred_to_hartron" }) }),
    ]);

    return {
      pending_refunds: pendingRefunds,
      not_submitted: notSubmitted,
      exempted,
      transferred_to_hartron: transferredToHartron,
    };
  }

  async getPurchaseOrderAndPbgMetrics(scopeIds = null) {
    const purchaseOrders = await PurchaseOrder.findAll({
      where: this.scopeWhere(scopeIds, "poIds"),
      include: [{ model: PbgEntry, as: "pbg_entries", required: false }],
      order: [["id", "DESC"]],
    });

    const today = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    const pbgEntries = await PbgEntry.findAll({
      where: this.pbgScopeWhere(scopeIds),
      include: [
        { model: PurchaseOrder, as: "purchase_order", required: false },
        { model: FirmModel, as: "firm", required: false },
      ],
      order: [["valid_upto", "ASC"]],
    });

    let poWithoutPbg = 0;
    let poShortOnPbg = 0;

    for (const purchaseOrder of purchaseOrders) {
      const entries = Array.isArray(purchaseOrder.pbg_entries) ? purchaseOrder.pbg_entries : [];
      if (entries.length === 0) {
        poWithoutPbg += 1;
        continue;
      }

      const totalPbgAmount = entries.reduce((sum, item) => sum + Number(item.pbg_amount || 0), 0);
      const requiredAmount = Number(purchaseOrder.required_pbg_amount || 0);
      if (requiredAmount > 0 && totalPbgAmount < requiredAmount) {
        poShortOnPbg += 1;
      }
    }

    const validExpiring30 = pbgEntries.filter((entry) => {
      if (!entry.valid_upto) return false;
      const validUpto = new Date(entry.valid_upto);
      return validUpto >= today && validUpto <= in30Days && String(entry.status || "").toLowerCase() !== "released";
    }).length;

    const claimExpiring30 = pbgEntries.filter((entry) => {
      if (!entry.claim_period_upto) return false;
      const claimUpto = new Date(entry.claim_period_upto);
      return claimUpto >= today && claimUpto <= in30Days && String(entry.refund_status || "").toLowerCase() !== "released";
    }).length;

    const releasePending = pbgEntries.filter((entry) =>
      ["held", "pending"].includes(String(entry.refund_status || "").toLowerCase()),
    ).length;

    return {
      purchase_orders_without_pbg: poWithoutPbg,
      purchase_orders_short_on_pbg: poShortOnPbg,
      pbg_validity_expiring_in_30_days: validExpiring30,
      pbg_claim_period_expiring_in_30_days: claimExpiring30,
      pbg_release_pending: releasePending,
    };
  }

  async getEmpanelmentMetrics(scopeIds = null) {
    if (scopeIds) {
      return {
        active_empanelments: 0,
        expiring_in_30_days: 0,
        expiring_in_60_days: 0,
        expired_empanelments: 0,
        category_coverage: 0,
      };
    }

    const today = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const in60Days = new Date();
    in60Days.setDate(in60Days.getDate() + 60);

    const empanelments = await Empanelment.findAll({
      include: [
        { model: EmpanelmentItemCategory, as: "item_categories", required: false },
        { model: FirmModel, as: "firm", required: false },
      ],
      order: [["current_valid_upto", "ASC"]],
    });

    const active = empanelments.filter((row) => ["active", "extended"].includes(String(row.status || "").toLowerCase()));
    const expiring30 = active.filter((row) => {
      if (!row.current_valid_upto) return false;
      const expiry = new Date(row.current_valid_upto);
      return expiry >= today && expiry <= in30Days;
    }).length;
    const expiring60 = active.filter((row) => {
      if (!row.current_valid_upto) return false;
      const expiry = new Date(row.current_valid_upto);
      return expiry >= today && expiry <= in60Days;
    }).length;
    const expired = empanelments.filter((row) => {
      if (!row.current_valid_upto) return false;
      return new Date(row.current_valid_upto) < today && String(row.status || "").toLowerCase() !== "inactive";
    }).length;
    const categoryCoverage = active.reduce(
      (sum, row) => sum + (Array.isArray(row.item_categories) ? row.item_categories.length : 0),
      0,
    );

    return {
      active_empanelments: active.length,
      expiring_in_30_days: expiring30,
      expiring_in_60_days: expiring60,
      expired_empanelments: expired,
      category_coverage: categoryCoverage,
    };
  }

  async getRecentActivity(scopeIds = null) {
    const [indents, cases, tenders, purchaseOrders, empanelments] = await Promise.all([
      Indent.findAll({
        where: this.scopeWhere(scopeIds, "indentIds"),
        attributes: ["id", "indent_no", "department_name", "status", "received_date", "created_at", "createdAt"],
        order: [["id", "DESC"]],
        limit: 5,
      }),
      ProcurementCase.findAll({
        where: this.scopeWhere(scopeIds, "caseIds"),
        attributes: ["id", "case_no", "title", "status", "procurement_mode", "created_at", "createdAt"],
        order: [["id", "DESC"]],
        limit: 5,
      }),
      Tender.findAll({
        where: this.scopeWhere(scopeIds, "tenderIds"),
        attributes: ["id", "tender_title", "portal_type", "status", "current_submission_deadline", "created_at", "createdAt"],
        order: [["id", "DESC"]],
        limit: 5,
      }),
      PurchaseOrder.findAll({
        where: this.scopeWhere(scopeIds, "poIds"),
        attributes: ["id", "po_no", "po_date", "status", "po_value", "created_at", "createdAt"],
        order: [["id", "DESC"]],
        limit: 5,
      }),
      scopeIds
        ? []
        : Empanelment.findAll({
            attributes: ["id", "empanelment_no", "status", "current_valid_upto", "created_at", "createdAt"],
            include: [{ model: FirmModel, as: "firm", attributes: ["firm_name"], required: false }],
            order: [["id", "DESC"]],
            limit: 5,
          }),
    ]);

    return {
      recent_indents: indents,
      recent_cases: cases,
      recent_tenders: tenders,
      recent_purchase_orders: purchaseOrders,
      recent_empanelments: empanelments,
    };
  }
}

module.exports = DashboardRepository;
