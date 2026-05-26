const { Op } = require("sequelize");
const { EmdRepository } = require("../repository/emd-repository");
const { Firm, Tender, TenderVendor, TenderEmdEntry, sequelize } = require("../../models");
const {
  EMD_EXEMPTION_STATUSES,
  EMD_SUBMISSION_MODES,
  EMD_SUBMISSION_STATUSES,
  REFUND_STATUSES,
  asAmountNumber,
  asId,
  assertAllowed,
  buildCursorResponse,
  hasOwn,
  isCursorMode,
  normalizeAmount,
  normalizeCursor,
  normalizeLimit,
  normalizeSortBy,
  normalizeSortDirection,
  normalizeNullableAmount,
  normalizeNullableDate,
  normalizeNullableText,
  normalizeText,
  notFound,
  requireDate,
  requireValue,
} = require("../utils/procurement-domain");

const EMD_SORT_FIELDS = [
  "id",
  "emd_submission_status",
  "emd_exemption_status",
  "submission_mode",
  "deposit_date",
  "refund_status",
  "finance_reference_no",
  "instrument_no",
  "utr_no",
  "bg_no",
  "emd_amount",
  "tender_fee_amount",
];

class EmdService {
  constructor() {
    this.repository = new EmdRepository();
  }

  decorateEntry(entry) {
    if (!entry) return entry;

    const tenderVendor = entry.tender_vendor;
    const tender = entry.tender;
    const purchaseOrders = Array.isArray(tender?.purchase_orders)
      ? tender.purchase_orders
      : [];
    const firmId = Number(tenderVendor?.firm_id || tenderVendor?.firm?.id || 0);
    const technicalStatus = String(tenderVendor?.technical_status || "").toLowerCase();
    const commercialStatus = String(tenderVendor?.commercial_status || "").toLowerCase();
    const technicalStatusUpdatedAt = tenderVendor?.technical_status_updated_at
      ? new Date(tenderVendor.technical_status_updated_at)
      : tenderVendor?.updatedAt
        ? new Date(tenderVendor.updatedAt)
        : null;
    const commercialStatusUpdatedAt = tenderVendor?.commercial_status_updated_at
      ? new Date(tenderVendor.commercial_status_updated_at)
      : tenderVendor?.updatedAt
        ? new Date(tenderVendor.updatedAt)
        : null;

    let triggerDate = null;
    let rule = null;
    let reason = null;

    if (technicalStatus === "disqualified" && technicalStatusUpdatedAt && !Number.isNaN(technicalStatusUpdatedAt.getTime())) {
      triggerDate = technicalStatusUpdatedAt;
      rule = "technical_disqualification";
      reason = "Vendor was disqualified in technical evaluation.";
    } else if (
      technicalStatus === "qualified" &&
      commercialStatus === "disqualified" &&
      commercialStatusUpdatedAt &&
      !Number.isNaN(commercialStatusUpdatedAt.getTime())
    ) {
      triggerDate = commercialStatusUpdatedAt;
      rule = "commercial_disqualification";
      reason = "Vendor was disqualified in commercial evaluation.";
    } else if (purchaseOrders.length) {
      const awardedToThisVendor = purchaseOrders.some(
        (purchaseOrder) => Number(purchaseOrder?.firm_id || 0) === firmId,
      );
      if (!awardedToThisVendor) {
        const sortedAwards = [...purchaseOrders].sort((left, right) => {
          const leftDate = new Date(left?.po_date || left?.createdAt || left?.created_at || 0).getTime();
          const rightDate = new Date(right?.po_date || right?.createdAt || right?.created_at || 0).getTime();
          return leftDate - rightDate;
        });
        const firstAward = sortedAwards[0];
        const awardDate = firstAward
          ? new Date(firstAward.po_date || firstAward.createdAt || firstAward.created_at)
          : null;
        if (awardDate && !Number.isNaN(awardDate.getTime())) {
          triggerDate = awardDate;
          rule = "award_to_other_bidder";
          reason = "Purchase order has been awarded to another bidder.";
        }
      }
    }

    const refundStatus = String(entry.refund_status || "not_due").toLowerCase();
    const hasRefundArtifacts = Boolean(
      entry.refund_date ||
        entry.refund_approval_copy_path ||
        entry.refund_receiving_copy_path ||
        entry.received_by_name ||
        entry.received_by_designation,
    );

    const advisory = {
      refund_rule: rule,
      refund_reason: reason,
      trigger_date: triggerDate ? triggerDate.toISOString() : null,
      due_date: null,
      is_due: false,
      is_overdue: false,
      days_remaining: null,
      should_show_refund_fields: refundStatus !== "not_due" || hasRefundArtifacts,
    };

    if (triggerDate) {
      const dueDate = new Date(triggerDate);
      dueDate.setDate(dueDate.getDate() + 15);
      const now = new Date();
      const diffMs = dueDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      advisory.due_date = dueDate.toISOString();
      advisory.is_due = true;
      advisory.is_overdue = diffMs < 0 && !["refunded", "forfeited"].includes(refundStatus);
      advisory.days_remaining = daysRemaining;
      advisory.should_show_refund_fields = true;
    }

    entry.dataValues = entry.dataValues || {};
    entry.dataValues.refund_advisory = advisory;
    return entry;
  }

  async list(query = {}) {
    const where = {};
    if (query.tender_id) where.tender_id = asId(query.tender_id, "Tender id");
    if (query.refund_status) where.refund_status = normalizeText(query.refund_status);
    if (query.emd_submission_status) where.emd_submission_status = normalizeText(query.emd_submission_status);
    const search = normalizeText(query.search);
    if (search) {
      where[Op.or] = [
        { finance_reference_no: { [Op.like]: `%${search}%` } },
        { instrument_no: { [Op.like]: `%${search}%` } },
        { utr_no: { [Op.like]: `%${search}%` } },
        { bg_no: { [Op.like]: `%${search}%` } },
        { emd_submission_status: { [Op.like]: `%${search}%` } },
        { refund_status: { [Op.like]: `%${search}%` } },
        { "$tender.tender_reference_no$": { [Op.like]: `%${search}%` } },
        { "$tender.tender_title$": { [Op.like]: `%${search}%` } },
        { "$tender_vendor.firm.firm_name$": { [Op.like]: `%${search}%` } },
        { "$tender_vendor.firm.firm_code$": { [Op.like]: `%${search}%` } },
      ];
    }

    const sortBy = normalizeSortBy(query.sortBy || query.sort_by, EMD_SORT_FIELDS, "id");
    const sortDirection = normalizeSortDirection(query.sortDir || query.sort_dir, "DESC");

    if (isCursorMode(query)) {
      const limit = normalizeLimit(query.limit);
      const cursor = normalizeCursor(query.cursor);
      const rows = await this.repository.list({
        where,
        limit: limit + 1,
        cursor,
        sortBy,
        sortDirection,
      });
      const response = buildCursorResponse(rows, limit, { sortBy, sortDirection });
      response.rows = response.rows.map((entry) => this.decorateEntry(entry));
      return response;
    }

    const rows = await this.repository.list({ where, limit: 150, sortBy, sortDirection });
    return rows.map((entry) => this.decorateEntry(entry));
  }

  async getById(id) {
    const entry = await this.repository.findByPk(asId(id, "EMD id"));
    if (!entry) throw notFound("EMD entry not found.");
    return this.decorateEntry(entry);
  }

  async create(payload = {}) {
    const tender_id = asId(payload.tender_id, "Tender id");
    const tender_vendor_id = asId(payload.tender_vendor_id, "Tender vendor id");
    const status = normalizeText(payload.emd_submission_status) || "not_submitted";
    const exemptionStatus = normalizeText(payload.emd_exemption_status) || "none";
    const submissionMode = normalizeText(payload.submission_mode);
    const refundStatus = normalizeText(payload.refund_status) || "not_due";

    assertAllowed(status, EMD_SUBMISSION_STATUSES, "EMD submission status");
    assertAllowed(exemptionStatus, EMD_EXEMPTION_STATUSES, "EMD exemption status");
    assertAllowed(submissionMode, EMD_SUBMISSION_MODES, "EMD submission mode");
    assertAllowed(refundStatus, REFUND_STATUSES, "EMD refund status");

    const tenderVendor = await this.repository.findTenderVendorByIdAndTender(tender_vendor_id, tender_id);
    if (!tenderVendor) {
      const error = new Error("Tender vendor does not belong to the selected tender.");
      error.statusCode = 400;
      throw error;
    }

    this.validateSubmissionFields({
      status,
      submissionMode,
      payload,
      exemptionStatus,
      merged: false,
    });

    return this.repository.create({
      tender_id,
      tender_vendor_id,
      emd_required: payload.emd_required !== false && exemptionStatus !== "full",
      emd_submission_status: status,
      emd_exemption_status: exemptionStatus,
      emd_exemption_reason: normalizeNullableText(payload.emd_exemption_reason),
      tender_fee_amount: normalizeAmount(payload.tender_fee_amount),
      emd_amount: normalizeAmount(payload.emd_amount),
      submission_mode: submissionMode || null,
      instrument_no: normalizeNullableText(payload.instrument_no),
      issuing_bank_name: normalizeNullableText(payload.issuing_bank_name),
      utr_no: normalizeNullableText(payload.utr_no),
      bg_no: normalizeNullableText(payload.bg_no),
      bg_valid_upto: requireDateOrUndefined(payload.bg_valid_upto),
      bg_claim_period_upto: requireDateOrUndefined(payload.bg_claim_period_upto),
      deposit_date: requireDateOrUndefined(payload.deposit_date),
      submission_document_path: normalizeNullableText(payload.submission_document_path),
      finance_reference_no: normalizeNullableText(payload.finance_reference_no),
      is_retained_after_technical_eval:
        payload.is_retained_after_technical_eval === undefined
          ? null
          : Boolean(payload.is_retained_after_technical_eval),
      refund_status: refundStatus,
      refund_date: requireDateOrUndefined(payload.refund_date),
      refund_approval_copy_path: normalizeNullableText(payload.refund_approval_copy_path),
      refund_receiving_copy_path: normalizeNullableText(payload.refund_receiving_copy_path),
      received_by_name: normalizeNullableText(payload.received_by_name),
      received_by_designation: normalizeNullableText(payload.received_by_designation),
      remarks: normalizeNullableText(payload.remarks),
    });
  }

  validateSubmissionFields({ status, submissionMode, payload, merged = false }) {
    if (status === "submitted" && !submissionMode) {
      const error = new Error("Submission mode is required when EMD is submitted.");
      error.statusCode = 400;
      throw error;
    }

    const utrNo = merged ? payload.utr_no : normalizeText(payload.utr_no);
    const instrumentNo = merged ? payload.instrument_no : normalizeText(payload.instrument_no);
    const bankName = merged ? payload.issuing_bank_name : normalizeText(payload.issuing_bank_name);
    const bgNo = merged ? payload.bg_no : normalizeText(payload.bg_no);
    const bgValidUpto = merged ? payload.bg_valid_upto : payload.bg_valid_upto ? requireDate({ value: payload.bg_valid_upto }, "value", "BG valid upto date") : null;
    const bgClaimPeriodUpto = merged ? payload.bg_claim_period_upto : payload.bg_claim_period_upto ? requireDate({ value: payload.bg_claim_period_upto }, "value", "BG claim period upto date") : null;

    if (submissionMode === "rtgs" && !utrNo) {
      const error = new Error("UTR number is required for RTGS EMD.");
      error.statusCode = 400;
      throw error;
    }

    if (["dd", "cheque"].includes(submissionMode)) {
      if (!instrumentNo || !bankName) {
        const error = new Error("DD/Cheque number and issuing bank are required.");
        error.statusCode = 400;
        throw error;
      }
    }

    if (submissionMode === "bg") {
      if (!bgNo || !bgValidUpto || !bgClaimPeriodUpto) {
        const error = new Error("BG number, valid upto, and claim period upto are required.");
        error.statusCode = 400;
        throw error;
      }
    }
  }

  async update(id, payload = {}) {
    const entry = await this.repository.findByPk(asId(id, "EMD id"), []);
    if (!entry) throw notFound("EMD entry not found.");

    const update = {};
    const mergedStatus = hasOwn(payload, "emd_submission_status")
      ? requireValue(payload, "emd_submission_status", "EMD submission status")
      : entry.emd_submission_status;
    const mergedExemptionStatus = hasOwn(payload, "emd_exemption_status")
      ? requireValue(payload, "emd_exemption_status", "EMD exemption status")
      : entry.emd_exemption_status;
    const mergedSubmissionMode = hasOwn(payload, "submission_mode")
      ? normalizeNullableText(payload.submission_mode)
      : entry.submission_mode;
    const mergedRefundStatus = hasOwn(payload, "refund_status")
      ? requireValue(payload, "refund_status", "EMD refund status")
      : entry.refund_status;

    assertAllowed(mergedStatus, EMD_SUBMISSION_STATUSES, "EMD submission status");
    assertAllowed(mergedExemptionStatus, EMD_EXEMPTION_STATUSES, "EMD exemption status");
    assertAllowed(mergedSubmissionMode, EMD_SUBMISSION_MODES, "EMD submission mode");
    assertAllowed(mergedRefundStatus, REFUND_STATUSES, "EMD refund status");

    const mergedPayload = {
      instrument_no: hasOwn(payload, "instrument_no")
        ? normalizeNullableText(payload.instrument_no)
        : entry.instrument_no,
      issuing_bank_name: hasOwn(payload, "issuing_bank_name")
        ? normalizeNullableText(payload.issuing_bank_name)
        : entry.issuing_bank_name,
      utr_no: hasOwn(payload, "utr_no") ? normalizeNullableText(payload.utr_no) : entry.utr_no,
      bg_no: hasOwn(payload, "bg_no") ? normalizeNullableText(payload.bg_no) : entry.bg_no,
      bg_valid_upto: hasOwn(payload, "bg_valid_upto")
        ? normalizeNullableDate(payload.bg_valid_upto)
        : entry.bg_valid_upto,
      bg_claim_period_upto: hasOwn(payload, "bg_claim_period_upto")
        ? normalizeNullableDate(payload.bg_claim_period_upto)
        : entry.bg_claim_period_upto,
    };

    this.validateSubmissionFields({
      status: mergedStatus,
      submissionMode: mergedSubmissionMode,
      payload: mergedPayload,
      merged: true,
    });

    if (hasOwn(payload, "emd_required")) update.emd_required = Boolean(payload.emd_required);
    if (mergedExemptionStatus === "full" && !hasOwn(payload, "emd_required")) update.emd_required = false;
    if (hasOwn(payload, "emd_submission_status")) update.emd_submission_status = mergedStatus;
    if (hasOwn(payload, "emd_exemption_status")) update.emd_exemption_status = mergedExemptionStatus;
    if (hasOwn(payload, "emd_exemption_reason")) update.emd_exemption_reason = normalizeNullableText(payload.emd_exemption_reason);
    if (hasOwn(payload, "tender_fee_amount")) update.tender_fee_amount = normalizeNullableAmount(payload.tender_fee_amount);
    if (hasOwn(payload, "emd_amount")) update.emd_amount = normalizeNullableAmount(payload.emd_amount);
    if (hasOwn(payload, "submission_mode")) update.submission_mode = mergedSubmissionMode;
    if (hasOwn(payload, "instrument_no")) update.instrument_no = mergedPayload.instrument_no;
    if (hasOwn(payload, "issuing_bank_name")) update.issuing_bank_name = mergedPayload.issuing_bank_name;
    if (hasOwn(payload, "utr_no")) update.utr_no = mergedPayload.utr_no;
    if (hasOwn(payload, "bg_no")) update.bg_no = mergedPayload.bg_no;
    if (hasOwn(payload, "bg_valid_upto")) update.bg_valid_upto = mergedPayload.bg_valid_upto;
    if (hasOwn(payload, "bg_claim_period_upto")) update.bg_claim_period_upto = mergedPayload.bg_claim_period_upto;
    if (hasOwn(payload, "deposit_date")) update.deposit_date = normalizeNullableDate(payload.deposit_date);
    if (hasOwn(payload, "submission_document_path")) update.submission_document_path = normalizeNullableText(payload.submission_document_path);
    if (hasOwn(payload, "finance_reference_no")) update.finance_reference_no = normalizeNullableText(payload.finance_reference_no);
    if (hasOwn(payload, "is_retained_after_technical_eval")) {
      update.is_retained_after_technical_eval =
        payload.is_retained_after_technical_eval === "" || payload.is_retained_after_technical_eval === null
          ? null
          : Boolean(payload.is_retained_after_technical_eval);
    }
    if (hasOwn(payload, "refund_status")) update.refund_status = mergedRefundStatus;
    if (hasOwn(payload, "refund_date")) update.refund_date = normalizeNullableDate(payload.refund_date);
    if (hasOwn(payload, "refund_approval_copy_path")) update.refund_approval_copy_path = normalizeNullableText(payload.refund_approval_copy_path);
    if (hasOwn(payload, "refund_receiving_copy_path")) update.refund_receiving_copy_path = normalizeNullableText(payload.refund_receiving_copy_path);
    if (hasOwn(payload, "received_by_name")) update.received_by_name = normalizeNullableText(payload.received_by_name);
    if (hasOwn(payload, "received_by_designation")) update.received_by_designation = normalizeNullableText(payload.received_by_designation);
    if (hasOwn(payload, "remarks")) update.remarks = normalizeNullableText(payload.remarks);

    await entry.update(update);
    return this.getById(id);
  }

  generateFirmCode() {
    return `FRM-${Date.now().toString(36).toUpperCase()}`;
  }

  async createWorkflow(payload = {}) {
    return sequelize.transaction(async (transaction) => {
      const firm = await Firm.create(
        {
          firm_code: normalizeText(payload.firm?.firm_code)?.toUpperCase() || this.generateFirmCode(),
          firm_name: requireValue(payload.firm || {}, "firm_name", "Firm name"),
          vendor_category: normalizeText(payload.firm?.vendor_category) || "general",
          vendor_type: normalizeNullableText(payload.firm?.vendor_type),
          gst_no: normalizeNullableText(payload.firm?.gst_no),
          pan_no: normalizeNullableText(payload.firm?.pan_no),
          msme_no: normalizeNullableText(payload.firm?.msme_no),
          msme_state: normalizeNullableText(payload.firm?.msme_state),
          remarks: normalizeNullableText(payload.firm?.remarks),
        },
        { transaction },
      );

      const portalType = requireValue(payload.tender || {}, "portal_type", "Procurement mode");
      const tenderIdentifiers = normalizeTenderIdentifiers(payload.tender || {}, portalType);

      const tender = await Tender.create(
        {
          tender_reference_no: tenderIdentifiers.tender_reference_no,
          portal_type: portalType,
          tender_title: requireValue(payload.tender || {}, "tender_title", "Tender title"),
          portal_bid_no: tenderIdentifiers.portal_bid_no,
          portal_ra_no: tenderIdentifiers.portal_ra_no,
          portal_tender_id: tenderIdentifiers.portal_tender_id,
          tender_value: normalizeAmount(payload.tender?.tender_value),
          emd_exemption_policy: normalizeText(payload.tender?.emd_exemption_policy) || "none",
          emd_amount: normalizeAmount(payload.tender?.emd_amount),
          tender_fee_amount: normalizeAmount(payload.tender?.tender_fee_amount),
          bid_publish_date: requireDateOrUndefined(payload.tender?.bid_publish_date),
          bid_submission_date: requireDateOrUndefined(payload.tender?.bid_submission_date),
          status: normalizeText(payload.tender?.status) || "draft",
          document_path: normalizeNullableText(payload.tender?.document_path),
          remarks: normalizeNullableText(payload.tender?.remarks),
          location_scope: requireValue(payload.tender || {}, "location_scope", "Location scope"),
        },
        { transaction },
      );

      const tenderVendor = await TenderVendor.create(
        {
          tender_id: tender.id,
          firm_id: firm.id,
          participation_status: normalizeText(payload.tender_vendor?.participation_status) || "participated",
          technical_status: normalizeText(payload.tender_vendor?.technical_status) || "pending",
          commercial_status: normalizeText(payload.tender_vendor?.commercial_status) || "pending",
          is_l1: Boolean(payload.tender_vendor?.is_l1),
          remarks: normalizeNullableText(payload.tender_vendor?.remarks),
        },
        { transaction },
      );

      const emdPayload = {
        ...(payload.emd || {}),
        tender_id: tender.id,
        tender_vendor_id: tenderVendor.id,
      };
      const emdStatus = normalizeText(emdPayload.emd_submission_status) || "not_submitted";
      const emdExemptionStatus = normalizeText(emdPayload.emd_exemption_status) || "none";
      const emdSubmissionMode = normalizeText(emdPayload.submission_mode);
      const emdRefundStatus = normalizeText(emdPayload.refund_status) || "not_due";

      assertAllowed(emdStatus, EMD_SUBMISSION_STATUSES, "EMD submission status");
      assertAllowed(emdExemptionStatus, EMD_EXEMPTION_STATUSES, "EMD exemption status");
      assertAllowed(emdSubmissionMode, EMD_SUBMISSION_MODES, "EMD submission mode");
      assertAllowed(emdRefundStatus, REFUND_STATUSES, "EMD refund status");

      this.validateSubmissionFields({
        status: emdStatus,
        submissionMode: emdSubmissionMode,
        payload: emdPayload,
      });

      const emd = await TenderEmdEntry.create(
        {
          tender_id: tender.id,
          tender_vendor_id: tenderVendor.id,
          emd_required: emdPayload.emd_required !== false && emdExemptionStatus !== "full",
          emd_submission_status: emdStatus,
          emd_exemption_status: emdExemptionStatus,
          emd_exemption_reason: normalizeNullableText(emdPayload.emd_exemption_reason),
          tender_fee_amount: normalizeAmount(emdPayload.tender_fee_amount),
          emd_amount: normalizeAmount(emdPayload.emd_amount),
          submission_mode: emdSubmissionMode || null,
          instrument_no: normalizeNullableText(emdPayload.instrument_no),
          issuing_bank_name: normalizeNullableText(emdPayload.issuing_bank_name),
          utr_no: normalizeNullableText(emdPayload.utr_no),
          bg_no: normalizeNullableText(emdPayload.bg_no),
          bg_valid_upto: requireDateOrUndefined(emdPayload.bg_valid_upto),
          bg_claim_period_upto: requireDateOrUndefined(emdPayload.bg_claim_period_upto),
          deposit_date: requireDateOrUndefined(emdPayload.deposit_date),
          finance_reference_no: normalizeNullableText(emdPayload.finance_reference_no),
          refund_status: emdRefundStatus,
          refund_date: requireDateOrUndefined(emdPayload.refund_date),
          remarks: normalizeNullableText(emdPayload.remarks),
        },
        { transaction },
      );

      return { firm, tender, tender_vendor: tenderVendor, emd };
    });
  }
}

const requireDateOrUndefined = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  return requireDate({ value }, "value", "Date");
};

const GEM_TENDER_MODES = new Set(["gem", "gem_nic_split"]);
const NIC_TENDER_MODES = new Set(["nic", "gem_nic_split"]);

const normalizeTenderIdentifiers = (payload = {}, portalType) => {
  const usesGem = GEM_TENDER_MODES.has(portalType);
  const usesNic = NIC_TENDER_MODES.has(portalType);

  return {
    tender_reference_no: usesNic
      ? requireValue(payload, "tender_reference_no", "Tender reference number")
      : null,
    portal_bid_no: usesGem
      ? requireValue(payload, "portal_bid_no", "GeM bid id")
      : null,
    portal_ra_no: usesGem ? normalizeNullableText(payload.portal_ra_no) : null,
    portal_tender_id: usesNic
      ? requireValue(payload, "portal_tender_id", "Tender id")
      : null,
  };
};

module.exports = EmdService;
