"use strict";

const { Op } = require("sequelize");
const {
  CommitteeMeeting,
  DepartmentFundEntry,
  Indent,
  IndentItem,
  ProcurementCase,
  Tender,
  TenderVendor,
  TenderEmdEntry,
  PurchaseOrder,
  PurchaseOrderPayment,
  PbgEntry,
  Firm,
} = require("../../models");
const {
  asAmountNumber,
  buildPurchaseOrderPaymentSummary,
  buildPurchaseOrderPbgSummary,
  roundAmount,
} = require("../utils/procurement-domain");

const toDepartmentName = (value) => String(value || "").trim() || "Unspecified Department";

const addAmount = (target, key, value) => {
  target[key] = roundAmount(asAmountNumber(target[key]) + asAmountNumber(value));
};

const latestOf = (...values) => {
  const timestamps = values
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .map((date) => date.getTime());

  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps)).toISOString();
};

class ReportRepository {
  async getOverviewCounts() {
    const [
      totalIndents,
      totalCases,
      totalTenders,
      totalPurchaseOrders,
      totalDepartmentFunds,
      totalCommittees,
    ] = await Promise.all([
      Indent.count(),
      ProcurementCase.count(),
      Tender.count(),
      PurchaseOrder.count(),
      DepartmentFundEntry.count(),
      require("../../models").CommitteeMeeting.count(),
    ]);

    return {
      total_indents: totalIndents,
      total_procurement_cases: totalCases,
      total_tenders: totalTenders,
      total_purchase_orders: totalPurchaseOrders,
      total_department_fund_entries: totalDepartmentFunds,
      total_committee_meetings: totalCommittees,
    };
  }

  async getValueFlowMetrics() {
    const [
      indentItems,
      procurementCases,
      tenders,
      purchaseOrders,
      departmentFunds,
      vendorPayments,
    ] = await Promise.all([
      IndentItem.findAll({ attributes: ["estimated_amount"] }),
      ProcurementCase.findAll({ attributes: ["estimated_value"] }),
      Tender.findAll({ attributes: ["tender_value"] }),
      PurchaseOrder.findAll({ attributes: ["po_value"] }),
      DepartmentFundEntry.findAll({ attributes: ["entry_type", "amount"] }),
      PurchaseOrderPayment.findAll({ attributes: ["payment_amount"] }),
    ]);

    const sum = (rows, key, predicate = null) =>
      roundAmount(
        (Array.isArray(rows) ? rows : [])
          .filter((row) => (typeof predicate === "function" ? predicate(row) : true))
          .reduce((total, row) => total + asAmountNumber(row?.[key]), 0),
      );

    const fundsIn = sum(
      departmentFunds,
      "amount",
      (row) => ["parked", "received", "carry_forward"].includes(String(row?.entry_type || "").toLowerCase()),
    );
    const fundsOut = sum(
      departmentFunds,
      "amount",
      (row) => ["vendor_payment", "adjusted", "refunded"].includes(String(row?.entry_type || "").toLowerCase()),
    );

    return {
      indent_estimated_value: sum(indentItems, "estimated_amount"),
      procurement_case_estimated_value: sum(procurementCases, "estimated_value"),
      tender_value: sum(tenders, "tender_value"),
      purchase_order_value: sum(purchaseOrders, "po_value"),
      department_fund_inflow: fundsIn,
      department_fund_outflow: fundsOut,
      department_fund_balance: roundAmount(fundsIn - fundsOut),
      vendor_payment_outflow: sum(vendorPayments, "payment_amount"),
    };
  }

  async getDepartmentRollup() {
    const [indents, procurementCases, tenders, purchaseOrders, fundEntries] = await Promise.all([
      Indent.findAll({
        attributes: ["id", "department_name", "status", "received_date", "createdAt"],
        include: [{ model: IndentItem, as: "items", attributes: ["id", "estimated_amount"], required: false }],
        order: [["id", "DESC"]],
      }),
      ProcurementCase.findAll({
        attributes: ["id", "estimated_value", "status", "createdAt"],
        include: [{ model: Indent, as: "indent", attributes: ["department_name"], required: false }],
      }),
      Tender.findAll({
        attributes: ["id", "tender_value", "status", "current_submission_deadline", "createdAt"],
        include: [
          {
            model: ProcurementCase,
            as: "procurement_case",
            attributes: ["id"],
            required: false,
            include: [{ model: Indent, as: "indent", attributes: ["department_name"], required: false }],
          },
        ],
      }),
      PurchaseOrder.findAll({
        attributes: ["id", "po_value", "po_date", "status", "createdAt"],
        include: [
          {
            model: Tender,
            as: "tender",
            attributes: ["id"],
            required: false,
            include: [
              {
                model: ProcurementCase,
                as: "procurement_case",
                attributes: ["id"],
                required: false,
                include: [{ model: Indent, as: "indent", attributes: ["department_name"], required: false }],
              },
            ],
          },
        ],
      }),
      DepartmentFundEntry.findAll({
        attributes: ["department_name", "entry_type", "amount", "entry_date", "entry_origin"],
        order: [["entry_date", "DESC"]],
      }),
    ]);

    const buckets = new Map();
    const ensureBucket = (name) => {
      const departmentName = toDepartmentName(name);
      if (!buckets.has(departmentName)) {
        buckets.set(departmentName, {
          department_name: departmentName,
          indent_count: 0,
          procurement_case_count: 0,
          tender_count: 0,
          purchase_order_count: 0,
          indent_estimated_value: 0,
          procurement_case_estimated_value: 0,
          tender_value: 0,
          purchase_order_value: 0,
          parked_amount: 0,
          received_amount: 0,
          vendor_payment_amount: 0,
          adjusted_amount: 0,
          refunded_amount: 0,
          carry_forward_amount: 0,
          total_fund_entries: 0,
          latest_activity_at: null,
        });
      }
      return buckets.get(departmentName);
    };

    for (const indent of indents) {
      const bucket = ensureBucket(indent?.department_name);
      bucket.indent_count += 1;
      addAmount(
        bucket,
        "indent_estimated_value",
        (Array.isArray(indent?.items) ? indent.items : []).reduce(
          (total, item) => total + asAmountNumber(item?.estimated_amount),
          0,
        ),
      );
      bucket.latest_activity_at = latestOf(bucket.latest_activity_at, indent?.received_date, indent?.createdAt);
    }

    for (const row of procurementCases) {
      const bucket = ensureBucket(row?.indent?.department_name);
      bucket.procurement_case_count += 1;
      addAmount(bucket, "procurement_case_estimated_value", row?.estimated_value);
      bucket.latest_activity_at = latestOf(bucket.latest_activity_at, row?.createdAt);
    }

    for (const row of tenders) {
      const bucket = ensureBucket(row?.procurement_case?.indent?.department_name);
      bucket.tender_count += 1;
      addAmount(bucket, "tender_value", row?.tender_value);
      bucket.latest_activity_at = latestOf(
        bucket.latest_activity_at,
        row?.current_submission_deadline,
        row?.createdAt,
      );
    }

    for (const row of purchaseOrders) {
      const bucket = ensureBucket(row?.tender?.procurement_case?.indent?.department_name);
      bucket.purchase_order_count += 1;
      addAmount(bucket, "purchase_order_value", row?.po_value);
      bucket.latest_activity_at = latestOf(bucket.latest_activity_at, row?.po_date, row?.createdAt);
    }

    for (const row of fundEntries) {
      const bucket = ensureBucket(row?.department_name);
      bucket.total_fund_entries += 1;
      const entryType = String(row?.entry_type || "").toLowerCase();
      if (entryType === "parked") addAmount(bucket, "parked_amount", row?.amount);
      if (entryType === "received") addAmount(bucket, "received_amount", row?.amount);
      if (entryType === "vendor_payment") addAmount(bucket, "vendor_payment_amount", row?.amount);
      if (entryType === "adjusted") addAmount(bucket, "adjusted_amount", row?.amount);
      if (entryType === "refunded") addAmount(bucket, "refunded_amount", row?.amount);
      if (entryType === "carry_forward") addAmount(bucket, "carry_forward_amount", row?.amount);
      bucket.latest_activity_at = latestOf(bucket.latest_activity_at, row?.entry_date);
    }

    const rows = Array.from(buckets.values()).map((bucket) => {
      const inflow = roundAmount(
        asAmountNumber(bucket.parked_amount) +
          asAmountNumber(bucket.received_amount) +
          asAmountNumber(bucket.carry_forward_amount),
      );
      const outflow = roundAmount(
        asAmountNumber(bucket.vendor_payment_amount) +
          asAmountNumber(bucket.adjusted_amount) +
          asAmountNumber(bucket.refunded_amount),
      );
      return {
        ...bucket,
        fund_inflow: inflow,
        fund_outflow: outflow,
        net_balance: roundAmount(inflow - outflow),
      };
    });

    rows.sort((first, second) => {
      const valueDiff = asAmountNumber(second.purchase_order_value) - asAmountNumber(first.purchase_order_value);
      if (valueDiff !== 0) return valueDiff;
      return String(first.department_name || "").localeCompare(String(second.department_name || ""));
    });

    return rows;
  }

  async getFlowHealth() {
    const [
      unassignedItems,
      itemsWithoutEstimate,
      tenderModeCases,
      tenders,
      purchaseOrders,
      committeeMeetings,
    ] = await Promise.all([
      IndentItem.count({
        where: {
          [Op.or]: [{ assigned_procurement_officer_id: null }, { assignment_status: "unassigned" }],
        },
      }),
      IndentItem.count({
        where: {
          [Op.or]: [{ estimated_amount: null }, { estimated_rate: null }],
        },
      }),
      ProcurementCase.findAll({
        where: { procurement_mode: { [Op.in]: ["tender_gem", "tender_nic", "tender_split"] } },
        include: [{ model: Tender, as: "tenders", attributes: ["id"], required: false }],
      }),
      Tender.findAll({
        attributes: ["id", "status", "current_submission_deadline"],
        include: [
          {
            model: TenderVendor,
            as: "vendors",
            attributes: ["id"],
            required: false,
            include: [{ model: TenderEmdEntry, as: "emd_entry", attributes: ["id", "emd_submission_status"], required: false }],
          },
          {
            model: PurchaseOrder,
            as: "purchase_orders",
            attributes: ["id", "required_pbg_amount", "po_value"],
            required: false,
            include: [{ model: PbgEntry, as: "pbg_entries", attributes: ["id", "pbg_amount"], required: false }],
          },
        ],
      }),
      PurchaseOrder.findAll({
        attributes: ["id", "po_value"],
        include: [{ model: PurchaseOrderPayment, as: "vendor_payments", attributes: ["payment_amount"], required: false }],
      }),
      require("../../models").CommitteeMeeting.count(),
    ]);

    const today = Date.now();
    let tendersWithoutVendors = 0;
    let tendersWithEmdIssue = 0;
    let tendersWithPbgIssue = 0;
    let overdueSubmissionDeadlines = 0;

    for (const tender of tenders) {
      const vendors = Array.isArray(tender?.vendors) ? tender.vendors : [];
      const purchaseOrderRows = Array.isArray(tender?.purchase_orders) ? tender.purchase_orders : [];
      if (vendors.length === 0) tendersWithoutVendors += 1;

      const missingOrPendingEmd = vendors.some((vendor) => {
        const entry = vendor?.emd_entry;
        if (!entry) return true;
        return ["not_submitted", "pending"].includes(String(entry?.emd_submission_status || "").toLowerCase());
      });
      if (missingOrPendingEmd && vendors.length > 0) tendersWithEmdIssue += 1;

      const pbgIssue = purchaseOrderRows.some((po) => {
        const summary = buildPurchaseOrderPbgSummary(po);
        return summary.is_short;
      });
      if (pbgIssue) tendersWithPbgIssue += 1;

      const deadline = tender?.current_submission_deadline ? new Date(tender.current_submission_deadline).getTime() : null;
      const status = String(tender?.status || "").toLowerCase();
      if (deadline && deadline < today && !["closed", "cancelled", "awarded"].includes(status)) {
        overdueSubmissionDeadlines += 1;
      }
    }

    const purchaseOrdersPendingPayment = purchaseOrders.filter((row) => {
      const summary = buildPurchaseOrderPaymentSummary(row);
      return summary.pending_amount > 0;
    }).length;

    const tenderModeCasesWithoutTender = tenderModeCases.filter(
      (row) => !Array.isArray(row?.tenders) || row.tenders.length === 0,
    ).length;

    return {
      indents_pending_assignment: unassignedItems,
      indents_pending_estimate: itemsWithoutEstimate,
      procurement_cases_without_tender: tenderModeCasesWithoutTender,
      tenders_without_vendors: tendersWithoutVendors,
      tenders_with_emd_issue: tendersWithEmdIssue,
      tenders_with_pbg_issue: tendersWithPbgIssue,
      overdue_submission_deadlines: overdueSubmissionDeadlines,
      purchase_orders_pending_payment: purchaseOrdersPendingPayment,
      committee_meetings_recorded: committeeMeetings,
    };
  }

  async getPendingIndentWork() {
    const rows = await Indent.findAll({
      attributes: ["id", "indent_no", "department_name", "received_date", "status"],
      include: [
        {
          model: IndentItem,
          as: "items",
          attributes: ["id", "assignment_status", "assigned_procurement_officer_id", "estimated_amount", "estimated_rate"],
          required: false,
        },
      ],
      order: [["received_date", "DESC"], ["id", "DESC"]],
    });

    return rows
      .map((row) => {
        const items = Array.isArray(row?.items) ? row.items : [];
        const unassignedItems = items.filter(
          (item) =>
            !Number(item?.assigned_procurement_officer_id || 0) ||
            String(item?.assignment_status || "").toLowerCase() === "unassigned",
        ).length;
        const pendingEstimateItems = items.filter(
          (item) => !item?.estimated_amount || !item?.estimated_rate,
        ).length;
        return {
          id: row.id,
          indent_no: row.indent_no,
          department_name: row.department_name,
          received_date: row.received_date,
          status: row.status,
          total_items: items.length,
          unassigned_items: unassignedItems,
          pending_estimate_items: pendingEstimateItems,
        };
      })
      .filter((row) => row.unassigned_items > 0 || row.pending_estimate_items > 0)
      .slice(0, 20);
  }

  async getTenderAttention() {
    const rows = await Tender.findAll({
      attributes: ["id", "tender_title", "portal_type", "status", "current_submission_deadline", "tender_value"],
      include: [
        {
          model: ProcurementCase,
          as: "procurement_case",
          attributes: ["case_no"],
          required: false,
          include: [{ model: Indent, as: "indent", attributes: ["department_name"], required: false }],
        },
        {
          model: TenderVendor,
          as: "vendors",
          attributes: ["id"],
          required: false,
          include: [{ model: TenderEmdEntry, as: "emd_entry", attributes: ["id", "emd_submission_status"], required: false }],
        },
        {
          model: PurchaseOrder,
          as: "purchase_orders",
          attributes: ["id", "required_pbg_amount"],
          required: false,
          include: [{ model: PbgEntry, as: "pbg_entries", attributes: ["id", "pbg_amount"], required: false }],
        },
      ],
      order: [["id", "DESC"]],
    });

    const now = Date.now();

    return rows
      .map((row) => {
        const vendors = Array.isArray(row?.vendors) ? row.vendors : [];
        const purchaseOrders = Array.isArray(row?.purchase_orders) ? row.purchase_orders : [];
        const missingEmd = vendors.some((vendor) => {
          const entry = vendor?.emd_entry;
          if (!entry) return true;
          return ["not_submitted", "pending"].includes(String(entry?.emd_submission_status || "").toLowerCase());
        });
        const pbgIssue = purchaseOrders.some((po) => buildPurchaseOrderPbgSummary(po).is_short);
        const deadlineOverdue =
          row?.current_submission_deadline &&
          new Date(row.current_submission_deadline).getTime() < now &&
          !["closed", "cancelled", "awarded"].includes(String(row?.status || "").toLowerCase());

        return {
          id: row.id,
          tender_title: row.tender_title,
          portal_type: row.portal_type,
          status: row.status,
          department_name: row?.procurement_case?.indent?.department_name || "NA",
          case_no: row?.procurement_case?.case_no || "NA",
          vendor_count: vendors.length,
          emd_issue: missingEmd,
          pbg_issue: pbgIssue,
          overdue_deadline: Boolean(deadlineOverdue),
          current_submission_deadline: row.current_submission_deadline,
          tender_value: row.tender_value,
        };
      })
      .filter((row) => row.vendor_count === 0 || row.emd_issue || row.pbg_issue || row.overdue_deadline)
      .slice(0, 20);
  }

  async getPurchaseOrderPaymentPosition() {
    const rows = await PurchaseOrder.findAll({
      attributes: ["id", "po_no", "po_date", "po_value", "status"],
      include: [
        { model: Firm, as: "firm", attributes: ["firm_name"], required: false },
        { model: PurchaseOrderPayment, as: "vendor_payments", attributes: ["payment_amount", "payment_date"], required: false },
        {
          model: Tender,
          as: "tender",
          attributes: ["tender_title"],
          required: false,
          include: [
            {
              model: ProcurementCase,
              as: "procurement_case",
              attributes: ["case_no"],
              required: false,
              include: [{ model: Indent, as: "indent", attributes: ["department_name"], required: false }],
            },
          ],
        },
      ],
      order: [["po_date", "DESC"], ["id", "DESC"]],
    });

    return rows
      .map((row) => {
        const paymentSummary = buildPurchaseOrderPaymentSummary(row);
        return {
          id: row.id,
          po_no: row.po_no,
          po_date: row.po_date,
          po_value: row.po_value,
          status: row.status,
          firm_name: row?.firm?.firm_name || "NA",
          tender_title: row?.tender?.tender_title || "NA",
          department_name: row?.tender?.procurement_case?.indent?.department_name || "NA",
          case_no: row?.tender?.procurement_case?.case_no || "NA",
          total_paid_amount: paymentSummary.total_paid_amount,
          pending_amount: paymentSummary.pending_amount,
          paid_percentage: paymentSummary.paid_percentage,
          payment_entry_count: paymentSummary.total_entries,
          latest_payment_date: latestOf(...(Array.isArray(row?.vendor_payments) ? row.vendor_payments.map((item) => item?.payment_date) : [])),
        };
      })
      .filter((row) => row.pending_amount > 0)
      .slice(0, 25);
  }

  async getTenderLifecycleReport() {
    const rows = await Tender.findAll({
      attributes: [
        "id",
        "tender_title",
        "portal_type",
        "status",
        "bid_publish_date",
        "bid_submission_date",
        "current_submission_deadline",
        "bid_opening_date",
        "file_no",
        "createdAt",
      ],
      include: [
        {
          model: ProcurementCase,
          as: "procurement_case",
          attributes: ["id", "case_no", "status", "createdAt"],
          required: false,
          include: [
            {
              model: Indent,
              as: "indent",
              attributes: ["id", "indent_no", "indent_date", "received_date", "department_name", "cfms_no", "createdAt"],
              required: false,
              include: [
                {
                  model: require("../../models").ProcurementEmployee,
                  as: "creator",
                  attributes: ["employee_name"],
                  required: false,
                },
              ],
            },
          ],
        },
        {
          model: CommitteeMeeting,
          as: "committee_meetings",
          attributes: ["id", "meeting_type", "meeting_date", "status"],
          required: false,
        },
        {
          model: PurchaseOrder,
          as: "purchase_orders",
          attributes: ["id", "po_no", "po_date", "po_value", "status"],
          required: false,
          include: [
            {
              model: PurchaseOrderPayment,
              as: "vendor_payments",
              attributes: ["id", "payment_amount", "payment_date"],
              required: false,
            },
          ],
        },
      ],
      order: [["id", "DESC"]],
    });

    return rows.map((row) => {
      const tenderCase = row?.procurement_case;
      const indent = tenderCase?.indent;
      const meetings = Array.isArray(row?.committee_meetings) ? row.committee_meetings : [];
      const purchaseOrders = Array.isArray(row?.purchase_orders) ? row.purchase_orders : [];
      const paymentRows = purchaseOrders.flatMap((po) =>
        Array.isArray(po?.vendor_payments) ? po.vendor_payments : [],
      );
      const totalPoValue = purchaseOrders.reduce(
        (total, po) => total + asAmountNumber(po?.po_value),
        0,
      );
      const totalPaidValue = paymentRows.reduce(
        (total, payment) => total + asAmountNumber(payment?.payment_amount),
        0,
      );
      const paymentPending = roundAmount(totalPoValue - totalPaidValue);
      const meetingTypes = Array.from(
        new Set(
          meetings
            .map((meeting) => String(meeting?.meeting_type || "").trim())
            .filter(Boolean),
        ),
      );

      return {
        id: row.id,
        department_name: indent?.department_name || "NA",
        indent_no: indent?.indent_no || "NA",
        indent_date: indent?.indent_date || null,
        indent_received_date: indent?.received_date || null,
        indent_created_by: indent?.creator?.employee_name || "NA",
        cfms_no: indent?.cfms_no || "NA",
        case_no: tenderCase?.case_no || "NA",
        case_status: tenderCase?.status || "NA",
        tender_title: row.tender_title,
        tender_portal: row.portal_type,
        tender_status: row.status,
        file_no: row.file_no || "NA",
        tender_created_at: row.createdAt,
        bid_publish_date: row.bid_publish_date,
        bid_submission_date: row.bid_submission_date,
        current_submission_deadline: row.current_submission_deadline,
        bid_opening_date: row.bid_opening_date,
        meeting_count: meetings.length,
        meeting_types: meetingTypes.length ? meetingTypes.join(", ") : "NA",
        latest_meeting_date: latestOf(...meetings.map((meeting) => meeting?.meeting_date)),
        purchase_order_count: purchaseOrders.length,
        purchase_order_numbers: purchaseOrders.length
          ? purchaseOrders.map((po) => po?.po_no).filter(Boolean).join(", ")
          : "NA",
        latest_po_date: latestOf(...purchaseOrders.map((po) => po?.po_date)),
        total_po_value: roundAmount(totalPoValue),
        payment_entry_count: paymentRows.length,
        latest_payment_date: latestOf(...paymentRows.map((payment) => payment?.payment_date)),
        total_paid_value: roundAmount(totalPaidValue),
        payment_pending_value: paymentPending > 0 ? paymentPending : 0,
      };
    });
  }
}

module.exports = ReportRepository;
