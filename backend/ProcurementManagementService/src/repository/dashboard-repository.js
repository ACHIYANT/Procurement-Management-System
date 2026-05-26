const { Op } = require("sequelize");
const {
  Firm,
  ProcurementEmployee,
  Indent,
  IndentItem,
  ProcurementCase,
  Tender,
  TenderVendor,
  TenderEmdEntry,
  PurchaseOrder,
  PbgEntry,
  Empanelment,
  EmpanelmentItemCategory,
  Firm: FirmModel,
} = require("../../models");

class DashboardRepository {
  async getValueMetrics() {
    const [
      indentItems,
      procurementCases,
      tenders,
      purchaseOrders,
      emdEntries,
      pbgEntries,
    ] = await Promise.all([
      IndentItem.findAll({ attributes: ["estimated_amount"] }),
      ProcurementCase.findAll({ attributes: ["estimated_value"] }),
      Tender.findAll({ attributes: ["tender_value", "emd_amount", "tender_fee_amount"] }),
      PurchaseOrder.findAll({ attributes: ["po_value", "required_pbg_amount"] }),
      TenderEmdEntry.findAll({ attributes: ["emd_amount", "tender_fee_amount"] }),
      PbgEntry.findAll({ attributes: ["pbg_amount"] }),
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

  async getOverviewCounts() {
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
      Indent.count(),
      ProcurementCase.count(),
      Tender.count(),
      PurchaseOrder.count(),
      TenderEmdEntry.count(),
      PbgEntry.count(),
      Empanelment.count(),
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

  async getIndentMetrics() {
    const [
      unassignedItems,
      itemsWithoutEstimate,
      adminApprovalItems,
      activeIndents,
    ] = await Promise.all([
      IndentItem.count({
        where: {
          [Op.or]: [
            { assigned_procurement_officer_id: null },
            { assignment_status: "unassigned" },
          ],
        },
      }),
      IndentItem.count({
        where: {
          [Op.or]: [{ estimated_amount: null }, { estimated_rate: null }],
        },
      }),
      IndentItem.count({
        where: { administrative_approval_required: true },
      }),
      Indent.count({
        where: {
          status: {
            [Op.notIn]: ["closed", "cancelled", "completed"],
          },
        },
      }),
    ]);

    return {
      active_indents: activeIndents,
      unassigned_items: unassignedItems,
      items_without_estimate: itemsWithoutEstimate,
      items_requiring_admin_approval: adminApprovalItems,
    };
  }

  async getProcurementCaseMetrics() {
    const tenderModes = ["tender_gem", "tender_nic", "tender_split"];
    const [casesWithoutOfficer, tenderModeCases] = await Promise.all([
      ProcurementCase.count({
        where: {
          [Op.or]: [{ procurement_officer_id: null }, { procurement_officer_id: { [Op.is]: null } }],
        },
      }),
      ProcurementCase.findAll({
        where: { procurement_mode: { [Op.in]: tenderModes } },
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

  async getTenderAttentionMetrics() {
    const tenders = await Tender.findAll({
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

  async getEmdMetrics() {
    const [pendingRefunds, notSubmitted, exempted, transferredToHartron] = await Promise.all([
      TenderEmdEntry.count({ where: { refund_status: "pending" } }),
      TenderEmdEntry.count({ where: { emd_submission_status: "not_submitted" } }),
      TenderEmdEntry.count({ where: { emd_submission_status: "exempted" } }),
      TenderEmdEntry.count({ where: { emd_submission_status: "transferred_to_hartron" } }),
    ]);

    return {
      pending_refunds: pendingRefunds,
      not_submitted: notSubmitted,
      exempted,
      transferred_to_hartron: transferredToHartron,
    };
  }

  async getPurchaseOrderAndPbgMetrics() {
    const purchaseOrders = await PurchaseOrder.findAll({
      include: [{ model: PbgEntry, as: "pbg_entries", required: false }],
      order: [["id", "DESC"]],
    });

    const today = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    const pbgEntries = await PbgEntry.findAll({
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

  async getEmpanelmentMetrics() {
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

  async getRecentActivity() {
    const [indents, cases, tenders, purchaseOrders, empanelments] = await Promise.all([
      Indent.findAll({
        attributes: ["id", "indent_no", "department_name", "status", "received_date", "created_at", "createdAt"],
        order: [["id", "DESC"]],
        limit: 5,
      }),
      ProcurementCase.findAll({
        attributes: ["id", "case_no", "title", "status", "procurement_mode", "created_at", "createdAt"],
        order: [["id", "DESC"]],
        limit: 5,
      }),
      Tender.findAll({
        attributes: ["id", "tender_title", "portal_type", "status", "current_submission_deadline", "created_at", "createdAt"],
        order: [["id", "DESC"]],
        limit: 5,
      }),
      PurchaseOrder.findAll({
        attributes: ["id", "po_no", "po_date", "status", "po_value", "created_at", "createdAt"],
        order: [["id", "DESC"]],
        limit: 5,
      }),
      Empanelment.findAll({
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
