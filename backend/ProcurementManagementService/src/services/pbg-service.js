const { Op } = require("sequelize");
const { PbgRepository } = require("../repository/pbg-repository");
const { Firm, PurchaseOrder, PbgEntry, Tender, sequelize } = require("../../models");
const PbgEngineService = require("./pbg-engine-service");
const {
  PBG_REFUND_STATUSES,
  PBG_STATUSES,
  PBG_SUBMISSION_MODES,
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
  requireAmount,
  requireDate,
  requireValue,
} = require("../utils/procurement-domain");

const PBG_SORT_FIELDS = [
  "id",
  "bank_guarantee_no",
  "issuing_bank_name",
  "status",
  "refund_status",
  "pbg_amount",
  "valid_upto",
  "claim_period_upto",
];

class PbgService {
  constructor() {
    this.repository = new PbgRepository();
    this.engineService = new PbgEngineService();
  }

  async list(query = {}) {
    const where = {};
    if (query.po_id) where.po_id = asId(query.po_id, "PO id");
    if (query.firm_id) where.firm_id = asId(query.firm_id, "Firm id");
    if (query.tender_id) where.tender_id = asId(query.tender_id, "Tender id");
    if (query.status) where.status = normalizeText(query.status);
    const search = normalizeText(query.search);
    if (search) {
      where[Op.or] = [
        { bank_guarantee_no: { [Op.like]: `%${search}%` } },
        { issuing_bank_name: { [Op.like]: `%${search}%` } },
        { status: { [Op.like]: `%${search}%` } },
        { refund_status: { [Op.like]: `%${search}%` } },
        { "$firm.firm_name$": { [Op.like]: `%${search}%` } },
        { "$firm.firm_code$": { [Op.like]: `%${search}%` } },
        { "$purchase_order.po_no$": { [Op.like]: `%${search}%` } },
      ];
    }

    const sortBy = normalizeSortBy(query.sortBy || query.sort_by, PBG_SORT_FIELDS, "id");
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
      return buildCursorResponse(rows, limit, { sortBy, sortDirection });
    }

    return this.repository.list({ where, limit: 150, sortBy, sortDirection });
  }

  async getById(id) {
    const entry = await this.repository.findByPk(asId(id, "PBG id"));
    if (!entry) throw notFound("PBG entry not found.");
    return entry;
  }

  validateBankGuaranteeFields({ submissionMode, bankGuaranteeNo, bankName, validUpto, claimUpto }) {
    if (submissionMode === "bank_guarantee") {
      if (!bankGuaranteeNo || !bankName || !validUpto || !claimUpto) {
        const error = new Error("Bank guarantee number, issuing bank, valid upto, and claim period upto are required.");
        error.statusCode = 400;
        throw error;
      }
    }
  }

  async create(payload = {}) {
    const po_id =
      payload.po_id === undefined || payload.po_id === null || payload.po_id === ""
        ? null
        : asId(payload.po_id, "PO id");
    const tender_id =
      payload.tender_id === undefined ||
      payload.tender_id === null ||
      payload.tender_id === ""
        ? null
        : asId(payload.tender_id, "Tender id");
    const firm_id = asId(payload.firm_id, "Firm id");
    const submissionMode = normalizeText(payload.submission_mode) || "bank_guarantee";
    const status = normalizeText(payload.status) || "active";
    const refundStatus = normalizeText(payload.refund_status) || "held";

    assertAllowed(submissionMode, PBG_SUBMISSION_MODES, "PBG submission mode");
    assertAllowed(status, PBG_STATUSES, "PBG status");
    assertAllowed(refundStatus, PBG_REFUND_STATUSES, "PBG refund status");

    let purchaseOrder = null;
    if (po_id) {
      purchaseOrder = await this.repository.findPurchaseOrderByIdAndFirm(po_id, firm_id);
      if (!purchaseOrder) {
        const error = new Error("Purchase order does not belong to the selected firm.");
        error.statusCode = 400;
        throw error;
      }
    }

    const resolvedTenderId =
      tender_id || Number(purchaseOrder?.tender_id || 0) || null;
    if (!resolvedTenderId) {
      const error = new Error("Tender is required for PBG receipt.");
      error.statusCode = 400;
      throw error;
    }

    const tender = await this.repository.findTenderByPk(resolvedTenderId);
    if (!tender) throw notFound("Tender not found.");

    this.validateBankGuaranteeFields({
      submissionMode,
      bankGuaranteeNo: normalizeText(payload.bank_guarantee_no),
      bankName: normalizeText(payload.issuing_bank_name),
      validUpto: payload.valid_upto ? requireDate(payload, "valid_upto", "PBG valid upto date") : null,
      claimUpto: payload.claim_period_upto ? requireDate(payload, "claim_period_upto", "PBG claim period upto date") : null,
    });

    const created = await this.repository.create({
      tender_id: resolvedTenderId,
      po_id,
      firm_id,
      pbg_amount: requireAmount(payload, "pbg_amount", "PBG amount"),
      submission_mode: submissionMode,
      status,
      bank_guarantee_no: normalizeNullableText(payload.bank_guarantee_no),
      issuing_bank_name: normalizeNullableText(payload.issuing_bank_name),
      issue_date: nullableDate(payload.issue_date),
      valid_upto: nullableDate(payload.valid_upto),
      claim_period_upto: nullableDate(payload.claim_period_upto),
      invocation_upto: nullableDate(payload.invocation_upto),
      pbg_percentage: normalizeAmount(payload.pbg_percentage),
      document_path: normalizeNullableText(payload.document_path),
      refund_status: refundStatus,
      refund_date: nullableDate(payload.refund_date),
      refund_approval_copy_path: normalizeNullableText(payload.refund_approval_copy_path),
      refund_receiving_copy_path: normalizeNullableText(payload.refund_receiving_copy_path),
      received_by_name: normalizeNullableText(payload.received_by_name),
      received_by_designation: normalizeNullableText(payload.received_by_designation),
      remarks: normalizeNullableText(payload.remarks),
    });
    await this.engineService.syncTenderObligations(resolvedTenderId);
    return this.getById(created.id);
  }

  async createForPurchaseOrder(poId, payload = {}) {
    const purchaseOrder = await this.repository.findPurchaseOrderByPk(asId(poId, "PO id"));
    if (!purchaseOrder) throw notFound("Purchase order not found.");

    const pbg = await this.create({
      ...payload,
      po_id: purchaseOrder.id,
      firm_id: purchaseOrder.firm_id,
    });

    return this.getById(pbg.id);
  }

  async update(id, payload = {}) {
    const entry = await this.repository.findByPk(asId(id, "PBG id"), []);
    if (!entry) throw notFound("PBG entry not found.");

    const update = {};
    const mergedSubmissionMode = hasOwn(payload, "submission_mode")
      ? requireValue(payload, "submission_mode", "PBG submission mode")
      : entry.submission_mode;
    const mergedStatus = hasOwn(payload, "status")
      ? requireValue(payload, "status", "PBG status")
      : entry.status;
    const mergedRefundStatus = hasOwn(payload, "refund_status")
      ? requireValue(payload, "refund_status", "PBG refund status")
      : entry.refund_status;

    assertAllowed(mergedSubmissionMode, PBG_SUBMISSION_MODES, "PBG submission mode");
    assertAllowed(mergedStatus, PBG_STATUSES, "PBG status");
    assertAllowed(mergedRefundStatus, PBG_REFUND_STATUSES, "PBG refund status");

    const mergedBgNo = hasOwn(payload, "bank_guarantee_no")
      ? normalizeNullableText(payload.bank_guarantee_no)
      : entry.bank_guarantee_no;
    const mergedBankName = hasOwn(payload, "issuing_bank_name")
      ? normalizeNullableText(payload.issuing_bank_name)
      : entry.issuing_bank_name;
    const mergedValidUpto = hasOwn(payload, "valid_upto")
      ? normalizeNullableDate(payload.valid_upto)
      : entry.valid_upto;
    const mergedClaimUpto = hasOwn(payload, "claim_period_upto")
      ? normalizeNullableDate(payload.claim_period_upto)
      : entry.claim_period_upto;
    const mergedInvocationUpto = hasOwn(payload, "invocation_upto")
      ? normalizeNullableDate(payload.invocation_upto)
      : entry.invocation_upto;

    this.validateBankGuaranteeFields({
      submissionMode: mergedSubmissionMode,
      bankGuaranteeNo: mergedBgNo,
      bankName: mergedBankName,
      validUpto: mergedValidUpto,
      claimUpto: mergedClaimUpto,
    });

    if (hasOwn(payload, "pbg_amount")) update.pbg_amount = requireAmount(payload, "pbg_amount", "PBG amount");
    if (hasOwn(payload, "submission_mode")) update.submission_mode = mergedSubmissionMode;
    if (hasOwn(payload, "status")) update.status = mergedStatus;
    if (hasOwn(payload, "bank_guarantee_no")) update.bank_guarantee_no = mergedBgNo;
    if (hasOwn(payload, "issuing_bank_name")) update.issuing_bank_name = mergedBankName;
    if (hasOwn(payload, "issue_date")) update.issue_date = normalizeNullableDate(payload.issue_date);
    if (hasOwn(payload, "valid_upto")) update.valid_upto = mergedValidUpto;
    if (hasOwn(payload, "claim_period_upto")) update.claim_period_upto = mergedClaimUpto;
    if (hasOwn(payload, "invocation_upto")) update.invocation_upto = mergedInvocationUpto;
    if (hasOwn(payload, "pbg_percentage")) update.pbg_percentage = normalizeNullableAmount(payload.pbg_percentage);
    if (hasOwn(payload, "document_path")) update.document_path = normalizeNullableText(payload.document_path);
    if (hasOwn(payload, "refund_status")) update.refund_status = mergedRefundStatus;
    if (hasOwn(payload, "refund_date")) update.refund_date = normalizeNullableDate(payload.refund_date);
    if (hasOwn(payload, "refund_approval_copy_path")) update.refund_approval_copy_path = normalizeNullableText(payload.refund_approval_copy_path);
    if (hasOwn(payload, "refund_receiving_copy_path")) update.refund_receiving_copy_path = normalizeNullableText(payload.refund_receiving_copy_path);
    if (hasOwn(payload, "received_by_name")) update.received_by_name = normalizeNullableText(payload.received_by_name);
    if (hasOwn(payload, "received_by_designation")) update.received_by_designation = normalizeNullableText(payload.received_by_designation);
    if (hasOwn(payload, "remarks")) update.remarks = normalizeNullableText(payload.remarks);

    await entry.update(update);
    if (entry.tender_id) {
      await this.engineService.syncTenderObligations(entry.tender_id);
    }
    return this.getById(id);
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

      const tender_id = payload.purchase_order?.tender_id
        ? asId(payload.purchase_order.tender_id, "Tender id")
        : null;

      if (tender_id) {
        const tender = await Tender.findByPk(tender_id, { transaction });
        if (!tender) {
          const error = new Error("Tender not found.");
          error.statusCode = 404;
          throw error;
        }
      }

      const workflowRequiredPbgPercentage = normalizeNullableAmount(
        payload.purchase_order?.required_pbg_percentage,
      );
      const workflowRequiredPbgAmount =
        payload.purchase_order?.required_pbg_amount === undefined ||
        payload.purchase_order?.required_pbg_amount === null ||
        payload.purchase_order?.required_pbg_amount === ""
          ? null
          : requireAmount(payload.purchase_order || {}, "required_pbg_amount", "Required PBG amount");

      const purchaseOrder = await PurchaseOrder.create(
        {
          tender_id,
          firm_id: firm.id,
          po_no: requireValue(payload.purchase_order || {}, "po_no", "PO number"),
          po_date: requireDate(payload.purchase_order || {}, "po_date", "PO date"),
          po_value: requireAmount(payload.purchase_order || {}, "po_value", "PO value"),
          required_pbg_amount:
            workflowRequiredPbgAmount ||
            normalizeAmount(
              (asAmountNumber(payload.purchase_order?.po_value) *
                asAmountNumber(workflowRequiredPbgPercentage)) /
                100,
            ),
          required_pbg_percentage: workflowRequiredPbgPercentage,
          status: normalizeText(payload.purchase_order?.status) || "released",
          inspection_required: payload.purchase_order?.inspection_required !== false,
          inspection_status: normalizeText(payload.purchase_order?.inspection_status) || "pending",
          delivery_status: normalizeText(payload.purchase_order?.delivery_status) || "pending",
          bill_submission_status: normalizeText(payload.purchase_order?.bill_submission_status) || "pending",
          remarks: normalizeNullableText(payload.purchase_order?.remarks),
        },
        { transaction },
      );

      const submissionMode = normalizeText(payload.pbg?.submission_mode) || "bank_guarantee";
      const status = normalizeText(payload.pbg?.status) || "active";
      const refundStatus = normalizeText(payload.pbg?.refund_status) || "held";

      assertAllowed(submissionMode, PBG_SUBMISSION_MODES, "PBG submission mode");
      assertAllowed(status, PBG_STATUSES, "PBG status");
      assertAllowed(refundStatus, PBG_REFUND_STATUSES, "PBG refund status");

      this.validateBankGuaranteeFields({
        submissionMode,
        bankGuaranteeNo: normalizeText(payload.pbg?.bank_guarantee_no),
        bankName: normalizeText(payload.pbg?.issuing_bank_name),
        validUpto: payload.pbg?.valid_upto ? requireDate(payload.pbg || {}, "valid_upto", "PBG valid upto date") : null,
        claimUpto: payload.pbg?.claim_period_upto ? requireDate(payload.pbg || {}, "claim_period_upto", "PBG claim period upto date") : null,
      });

      const pbg = await PbgEntry.create(
        {
          po_id: purchaseOrder.id,
          firm_id: firm.id,
          pbg_amount: requireAmount(payload.pbg || {}, "pbg_amount", "PBG amount"),
          submission_mode: submissionMode,
          status,
          bank_guarantee_no: normalizeNullableText(payload.pbg?.bank_guarantee_no),
          issuing_bank_name: normalizeNullableText(payload.pbg?.issuing_bank_name),
          issue_date: nullableDate(payload.pbg?.issue_date),
          valid_upto: nullableDate(payload.pbg?.valid_upto),
          claim_period_upto: nullableDate(payload.pbg?.claim_period_upto),
          pbg_percentage: normalizeAmount(payload.pbg?.pbg_percentage),
          document_path: normalizeNullableText(payload.pbg?.document_path),
          refund_status: refundStatus,
          refund_date: nullableDate(payload.pbg?.refund_date),
          refund_approval_copy_path: normalizeNullableText(payload.pbg?.refund_approval_copy_path),
          refund_receiving_copy_path: normalizeNullableText(payload.pbg?.refund_receiving_copy_path),
          received_by_name: normalizeNullableText(payload.pbg?.received_by_name),
          received_by_designation: normalizeNullableText(payload.pbg?.received_by_designation),
          remarks: normalizeNullableText(payload.pbg?.remarks),
        },
        { transaction },
      );

      return { firm, purchase_order: purchaseOrder, pbg };
    });
  }

  generateFirmCode() {
    return `FRM-${Date.now().toString(36).toUpperCase()}`;
  }
}

const nullableDate = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  return requireDate({ value }, "value", "Date");
};

module.exports = PbgService;
