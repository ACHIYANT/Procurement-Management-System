"use strict";

const { Op } = require("sequelize");
const { TenderRepository } = require("../repository/tender-repository");
const { ProcurementCaseRepository } = require("../repository/procurement-case-repository");
const PbgEngineService = require("./pbg-engine-service");
const {
  asAmountNumber,
  asId,
  buildCursorResponse,
  buildPurchaseOrderPbgSummary,
  decoratePurchaseOrder,
  isCursorMode,
  normalizeAmount,
  normalizeCursor,
  normalizeDate,
  normalizeLimit,
  normalizeSortBy,
  normalizeSortDirection,
  normalizeNullableDate,
  normalizeNullableText,
  normalizeText,
  notFound,
  requireDate,
  requireValue,
  roundAmount,
} = require("../utils/procurement-domain");

const TENDER_PORTAL_TYPES = new Set([
  "gem",
  "nic",
  "gem_nic_split",
  "empanelled",
  "direct_market",
  "known_vendor",
]);
const TENDER_TYPES = new Set([
  "open_tender",
  "limited_tender",
  "rate_contract",
  "proprietary_tender",
  "empanelment_tender",
  "amc_tender",
]);
const RATE_CONTRACT_TYPES = new Set(["quantity_based", "value_based"]);

const GEM_TENDER_MODES = new Set(["gem", "gem_nic_split"]);
const NIC_TENDER_MODES = new Set(["nic", "gem_nic_split"]);
const TECHNICAL_STATUSES = new Set(["pending", "qualified", "disqualified"]);
const COMMERCIAL_STATUSES = new Set(["pending", "qualified", "disqualified"]);
const LOA_ALLOCATION_SCOPES = new Set(["overall", "item_wise"]);
const TENDER_SORT_FIELDS = [
  "id",
  "tender_title",
  "portal_type",
  "leg_label",
  "portal_bid_no",
  "portal_ra_no",
  "tender_reference_no",
  "portal_tender_id",
  "tender_value",
  "emd_amount",
  "location_scope",
];

const normalizeDateTime = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error("Date-time value is invalid.");
    error.statusCode = 400;
    throw error;
  }
  return date;
};

const parseStoredDeadline = (value) => {
  if (!value) return null;
  const text = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T23:59:59`)
    : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

const assertAllowed = (value, allowed, label) => {
  if (value && !allowed.has(value)) {
    const error = new Error(`${label} is invalid.`);
    error.statusCode = 400;
    throw error;
  }
};

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

const normalizeTenderItems = (payloadItems = [], procurementCase = null) => {
  const caseItems = Array.isArray(procurementCase?.case_items)
    ? procurementCase.case_items
    : [];
  const caseItemById = new Map(
    caseItems.map((caseItem) => [Number(caseItem.id), caseItem]),
  );

  return (Array.isArray(payloadItems) ? payloadItems : [])
    .filter((item) => item?.selected !== false)
    .map((item) => {
      const caseItemId = item?.procurement_case_item_id
        ? asId(item.procurement_case_item_id, "Procurement case item")
        : null;
      const caseItem = caseItemId ? caseItemById.get(Number(caseItemId)) : null;
      const quantity =
        item?.tender_quantity === "" || item?.tender_quantity == null
          ? null
          : normalizeAmount(item?.tender_quantity ?? item?.quantity);
      const tenderValue =
        item?.tender_value === "" || item?.tender_value == null
          ? null
          : normalizeAmount(item?.tender_value);
      return {
        procurement_case_item_id: caseItemId,
        indent_item_id: caseItem?.indent_item_id || item?.indent_item_id || null,
        tender_quantity: quantity,
        tender_value: tenderValue,
        unit: normalizeNullableText(caseItem?.indent_item?.unit || item?.unit),
        remarks: normalizeNullableText(item?.remarks),
        case_item: caseItem,
      };
    })
    .filter(
      (item) =>
        item.procurement_case_item_id &&
        (asAmountNumber(item.tender_quantity) > 0 || asAmountNumber(item.tender_value) > 0),
    );
};

const getAlreadyTenderedQuantity = (caseItem) =>
  (Array.isArray(caseItem?.tender_items) ? caseItem.tender_items : []).reduce(
    (sum, tenderItem) => sum + asAmountNumber(tenderItem?.tender_quantity),
    0,
  );

const normalizeCommercialItemQuotes = (payloadQuotes = []) =>
  (Array.isArray(payloadQuotes) ? payloadQuotes : []).map((quote, index) => {
    const tenderItemId = asId(
      quote?.tender_item_id,
      `Commercial item quote #${index + 1} tender item`,
    );
    const quotedAmount =
      quote?.quoted_amount === "" || quote?.quoted_amount == null
        ? null
        : normalizeAmount(quote.quoted_amount);
    const negotiatedAmount =
      quote?.negotiated_amount === "" || quote?.negotiated_amount == null
        ? null
        : normalizeAmount(quote.negotiated_amount);
    const loaAllocatedQuantity =
      quote?.loa_allocated_quantity === "" ||
      quote?.loa_allocated_quantity == null
        ? null
        : normalizeAmount(quote.loa_allocated_quantity);
    const loaAllocatedAmount =
      quote?.loa_allocated_amount === "" || quote?.loa_allocated_amount == null
        ? null
        : normalizeAmount(quote.loa_allocated_amount);

    return {
      tender_item_id: tenderItemId,
      quoted_amount: quotedAmount,
      negotiated_amount: negotiatedAmount,
      loa_allocated_quantity: loaAllocatedQuantity,
      loa_allocated_amount: loaAllocatedAmount,
      make: normalizeNullableText(quote?.make),
      model: normalizeNullableText(quote?.model),
      remarks: normalizeNullableText(quote?.remarks),
    };
  });

const buildNegotiationItemRowsByVendorId = (tender, overrideVendorId, overrideRows) => {
  const result = {};
  const vendors = Array.isArray(tender?.vendors) ? tender.vendors : [];

  vendors.forEach((entry) => {
    const vendorId = Number(entry.id);
    const sourceRows =
      vendorId === Number(overrideVendorId)
        ? overrideRows
        : Array.isArray(entry.commercial_item_quotes)
          ? entry.commercial_item_quotes
          : [];
    result[vendorId] = sourceRows.map((quote) => ({
      tender_item_id: Number(quote.tender_item_id),
      negotiated_amount: asAmountNumber(quote.negotiated_amount),
    }));
  });

  return result;
};

const buildOverallL1VendorIds = (tender, overrideVendorId, overrideRows) => {
  const itemRowsByVendorId = buildNegotiationItemRowsByVendorId(
    tender,
    overrideVendorId,
    overrideRows,
  );
  const vendors = Array.isArray(tender?.vendors) ? tender.vendors : [];
  const rankedRows = vendors
    .map((vendor) => {
      const itemRows = itemRowsByVendorId[Number(vendor.id)] || [];
      const total = itemRows.reduce(
        (sum, quote) => sum + asAmountNumber(quote.negotiated_amount),
        0,
      );
      return total > 0 ? { vendorId: Number(vendor.id), total } : null;
    })
    .filter(Boolean);

  if (!rankedRows.length) return new Set();
  const lowestTotal = Math.min(...rankedRows.map((row) => row.total));
  return new Set(
    rankedRows
      .filter((row) => row.total === lowestTotal)
      .map((row) => row.vendorId),
  );
};

const buildItemWiseL1ItemIdsByVendorId = (tender, overrideVendorId, overrideRows) => {
  const itemRowsByVendorId = buildNegotiationItemRowsByVendorId(
    tender,
    overrideVendorId,
    overrideRows,
  );
  const tenderItems = Array.isArray(tender?.items) ? tender.items : [];
  const vendors = Array.isArray(tender?.vendors) ? tender.vendors : [];
  const result = {};

  vendors.forEach((vendor) => {
    result[Number(vendor.id)] = new Set();
  });

  tenderItems.forEach((item) => {
    const candidateRows = vendors
      .map((vendor) => {
        const itemRow = (itemRowsByVendorId[Number(vendor.id)] || []).find(
          (quote) => Number(quote.tender_item_id) === Number(item.id),
        );
        const price = asAmountNumber(itemRow?.negotiated_amount);
        return price > 0 ? { vendorId: Number(vendor.id), price } : null;
      })
      .filter(Boolean);

    if (!candidateRows.length) return;
    const lowestPrice = Math.min(...candidateRows.map((row) => row.price));
    candidateRows
      .filter((row) => row.price === lowestPrice)
      .forEach((row) => {
        result[row.vendorId].add(Number(item.id));
      });
  });

  return result;
};

const buildTenderEmdSummary = (tender) => {
  const vendors = Array.isArray(tender?.vendors) ? tender.vendors : [];
  const defaultExpectedAmount = asAmountNumber(tender?.emd_amount);
  let submittedCount = 0;
  let exemptedCount = 0;
  let pendingCount = 0;
  let shortCount = 0;
  let requiredAmount = 0;
  let submittedAmount = 0;
  let effectiveSubmittedAmount = 0;
  let totalShortAmount = 0;

  for (const vendor of vendors) {
    const entry = vendor?.emd_entry;
    const isExempted =
      entry?.emd_submission_status === "exempted" || entry?.emd_exemption_status === "full";
    const isRequired = !isExempted && (entry ? Boolean(entry.emd_required) : true);
    const expectedAmount = isRequired ? defaultExpectedAmount : 0;
    const submittedLikeStatuses = new Set(["submitted", "transferred_to_hartron"]);
    const isSubmitted = submittedLikeStatuses.has(String(entry?.emd_submission_status || ""));
    const currentSubmittedAmount = isSubmitted ? asAmountNumber(entry?.emd_amount) : 0;
    const effectiveVendorSubmittedAmount = isRequired
      ? Math.min(currentSubmittedAmount, expectedAmount)
      : currentSubmittedAmount;
    const shortAmount = isRequired
      ? roundAmount(Math.max(expectedAmount - currentSubmittedAmount, 0))
      : 0;

    if (isRequired) requiredAmount += expectedAmount;
    if (isSubmitted) submittedAmount += currentSubmittedAmount;
    if (isSubmitted) effectiveSubmittedAmount += effectiveVendorSubmittedAmount;
    if (isSubmitted) submittedCount += 1;
    if (isExempted) exemptedCount += 1;
    if (!entry || (!isSubmitted && !isExempted)) pendingCount += 1;
    if (isRequired && shortAmount > 0) shortCount += 1;
    if (isRequired) totalShortAmount += shortAmount;

    vendor.dataValues = vendor.dataValues || {};
    vendor.dataValues.emd_summary = {
      expected_amount: roundAmount(expectedAmount),
      submitted_amount: roundAmount(currentSubmittedAmount),
      effective_submitted_amount: roundAmount(effectiveVendorSubmittedAmount),
      short_amount: shortAmount,
      is_short: isRequired && shortAmount > 0,
    };
  }

  return {
    total_vendors: vendors.length,
    emd_records: vendors.filter((vendor) => vendor?.emd_entry).length,
    submitted_count: submittedCount,
    exempted_count: exemptedCount,
    pending_count: pendingCount,
    short_count: shortCount,
    required_amount: roundAmount(requiredAmount),
    submitted_amount: roundAmount(submittedAmount),
    compliant_submitted_amount: roundAmount(effectiveSubmittedAmount),
    short_amount: roundAmount(totalShortAmount),
    refund_pending_count: vendors.filter((vendor) => vendor?.emd_entry?.refund_status === "pending").length,
  };
};

class TenderService {
  constructor() {
    this.repository = new TenderRepository();
    this.procurementCaseRepository = new ProcurementCaseRepository();
    this.pbgEngineService = new PbgEngineService();
  }

  async decorateTender(tender) {
    if (!tender) return tender;
    tender.dataValues.emd_summary = buildTenderEmdSummary(tender);
    for (const po of tender.purchase_orders || []) {
      decoratePurchaseOrder(po);
    }
    return tender;
  }

  async decorateTenderListRows(tenders = []) {
    const rows = Array.isArray(tenders) ? tenders : [];
    if (!rows.length) return rows;

    const tenderIds = rows.map((row) => row?.id).filter(Boolean);
    if (!tenderIds.length) {
      return rows.map((row) => (typeof row?.toJSON === "function" ? row.toJSON() : row));
    }

    const [vendors, purchaseOrders] = await Promise.all([
      this.repository.findTendersWithVendorsAndEmd(tenderIds),
      this.repository.findPurchaseOrdersWithPbgByTenderIds(tenderIds),
    ]);

    const vendorsByTenderId = new Map();
    for (const vendor of vendors || []) {
      const tenderId = Number(vendor?.tender_id);
      if (!vendorsByTenderId.has(tenderId)) vendorsByTenderId.set(tenderId, []);
      vendorsByTenderId.get(tenderId).push(vendor);
    }

    const purchaseOrdersByTenderId = new Map();
    for (const purchaseOrder of purchaseOrders || []) {
      const tenderId = Number(purchaseOrder?.tender_id);
      if (!purchaseOrdersByTenderId.has(tenderId)) purchaseOrdersByTenderId.set(tenderId, []);
      purchaseOrdersByTenderId.get(tenderId).push(decoratePurchaseOrder(purchaseOrder));
    }

    return rows.map((row) => {
      const tender = typeof row?.toJSON === "function" ? row.toJSON() : { ...row };
      const tenderId = Number(tender.id);
      tender.vendors = vendorsByTenderId.get(tenderId) || [];
      tender.purchase_orders = purchaseOrdersByTenderId.get(tenderId) || [];

      const emdSummary = buildTenderEmdSummary(tender);
      const pbgSummary = tender.purchase_orders.reduce(
        (summary, purchaseOrder) => {
          const poSummary = purchaseOrder?.pbg_summary || buildPurchaseOrderPbgSummary(purchaseOrder);
          summary.purchase_orders += 1;
          summary.total_entries += Number(poSummary.total_entries || 0);
          summary.required_amount += asAmountNumber(poSummary.required_amount);
          summary.submitted_amount += asAmountNumber(poSummary.submitted_amount);
          summary.short_amount += asAmountNumber(poSummary.short_amount);
          summary.short_po_count += poSummary.is_short ? 1 : 0;
          return summary;
        },
        {
          purchase_orders: 0,
          total_entries: 0,
          required_amount: 0,
          submitted_amount: 0,
          short_amount: 0,
          short_po_count: 0,
        },
      );

      pbgSummary.required_amount = roundAmount(pbgSummary.required_amount);
      pbgSummary.submitted_amount = roundAmount(pbgSummary.submitted_amount);
      pbgSummary.short_amount = roundAmount(pbgSummary.short_amount);
      pbgSummary.is_short = pbgSummary.short_amount > 0;

      tender.emd_summary = emdSummary;
      tender.pbg_summary = pbgSummary;

      if (!emdSummary.total_vendors) {
        tender.emd_list_chip_label = "EMD None";
        tender.emd_list_chip_color = "gray";
      } else if (emdSummary.short_amount > 0) {
        tender.emd_list_chip_label = `EMD Short ${roundAmount(emdSummary.short_amount)}`;
        tender.emd_list_chip_color = "red";
      } else if (!emdSummary.emd_records) {
        tender.emd_list_chip_label = "EMD Pending";
        tender.emd_list_chip_color = "yellow";
      } else if (emdSummary.emd_records < emdSummary.total_vendors) {
        tender.emd_list_chip_label = `EMD ${emdSummary.emd_records}/${emdSummary.total_vendors}`;
        tender.emd_list_chip_color = "yellow";
      } else {
        tender.emd_list_chip_label = `EMD OK ${emdSummary.emd_records}`;
        tender.emd_list_chip_color = "green";
      }

      if (!pbgSummary.purchase_orders) {
        tender.pbg_list_chip_label = "PBG None";
        tender.pbg_list_chip_color = "gray";
      } else if (pbgSummary.short_amount > 0) {
        tender.pbg_list_chip_label = `PBG Short ${roundAmount(pbgSummary.short_amount)}`;
        tender.pbg_list_chip_color = "red";
      } else if (!pbgSummary.total_entries) {
        tender.pbg_list_chip_label = "PBG Pending";
        tender.pbg_list_chip_color = "yellow";
      } else {
        tender.pbg_list_chip_label = `PBG OK ${pbgSummary.total_entries}`;
        tender.pbg_list_chip_color = "cyan";
      }

      delete tender.vendors;
      delete tender.purchase_orders;
      return tender;
    });
  }

  async list(query = {}) {
    const search = normalizeText(query.search);
    const where = search
      ? {
          [Op.or]: [
            { tender_reference_no: { [Op.like]: `%${search}%` } },
            { tender_title: { [Op.like]: `%${search}%` } },
            { portal_bid_no: { [Op.like]: `%${search}%` } },
            { portal_tender_id: { [Op.like]: `%${search}%` } },
          ],
        }
      : {};

    const sortBy = normalizeSortBy(query.sortBy || query.sort_by, TENDER_SORT_FIELDS, "id");
    const sortDirection = normalizeSortDirection(query.sortDir || query.sort_dir, "DESC");

    if (isCursorMode(query)) {
      const limit = normalizeLimit(query.limit);
      const cursor = normalizeCursor(query.cursor);
      const rows = await this.repository.listBase({
        where,
        limit: limit + 1,
        cursor,
        sortBy,
        sortDirection,
      });
      const response = buildCursorResponse(rows, limit, { sortBy, sortDirection });
      response.rows = await this.decorateTenderListRows(response.rows);
      return response;
    }

    const tenders = await this.repository.listBase({
      where,
      limit: 100,
      sortBy,
      sortDirection,
    });
    return this.decorateTenderListRows(tenders);
  }

  async getById(id) {
    const tender = await this.repository.findByPk(asId(id, "Tender id"));
    if (!tender) throw notFound("Tender not found.");
    const decorated = await this.decorateTender(tender);
    decorated.dataValues.pbg_engine = await this.pbgEngineService.ensureTenderEngine(
      decorated.id,
    );
    return decorated;
  }

  async updatePbgSetup(tenderId, payload = {}) {
    const tender = await this.repository.findByPk(asId(tenderId, "Tender id"));
    if (!tender) throw notFound("Tender not found.");
    await this.pbgEngineService.saveTenderSetup(tender.id, payload);
    return this.getById(tender.id);
  }

  async create(payload = {}) {
    const portalType = requireValue(payload, "portal_type", "Procurement mode");
    assertAllowed(portalType, TENDER_PORTAL_TYPES, "Procurement mode");
    const tenderType = normalizeText(payload.tender_type) || "open_tender";
    assertAllowed(tenderType, TENDER_TYPES, "Tender type");
    const rateContractType = normalizeText(payload.rate_contract_type);
    if (tenderType === "rate_contract") {
      assertAllowed(rateContractType, RATE_CONTRACT_TYPES, "Rate contract type");
      if (!rateContractType) {
        const error = new Error("Rate contract type is required.");
        error.statusCode = 400;
        throw error;
      }
    }
    const tenderIdentifiers = normalizeTenderIdentifiers(payload, portalType);
    const procurementCaseId = payload.procurement_case_id ? asId(payload.procurement_case_id, "Procurement case id") : null;

    let procurementCase = null;
    if (procurementCaseId) {
      procurementCase = await this.repository.findProcurementCaseByPk(procurementCaseId);
      if (!procurementCase) throw notFound("Procurement case not found.");
    }

    const caseMode = normalizeText(procurementCase?.procurement_mode || "");
    const isSplitCase = caseMode === "tender_split";
    const tenderItems = normalizeTenderItems(payload.tender_items, procurementCase);
    const caseItems = Array.isArray(procurementCase?.case_items)
      ? procurementCase.case_items
      : [];

    if (isSplitCase && !["gem", "nic"].includes(portalType)) {
      const error = new Error("Split procurement cases require separate GeM or NIC tender legs.");
      error.statusCode = 400;
      throw error;
    }

    if (
      procurementCaseId &&
      caseItems.length &&
      !tenderItems.length
    ) {
      const error = new Error("At least one tender item is required.");
      error.statusCode = 400;
      throw error;
    }

    if (tenderType === "rate_contract" && rateContractType === "value_based") {
      const missingValueItem = tenderItems.find(
        (item) => asAmountNumber(item.tender_value) <= 0,
      );
      if (missingValueItem) {
        const error = new Error(
          `Tender value for ${missingValueItem.case_item?.indent_item?.item_name || "item"} is required for value-based rate contracts.`,
        );
        error.statusCode = 400;
        throw error;
      }
    }

    for (const tenderItem of tenderItems) {
      if (!tenderItem.case_item) {
        const error = new Error("Selected tender item does not belong to this procurement case.");
        error.statusCode = 400;
        throw error;
      }
      if (!tenderItem.indent_item_id) {
        const error = new Error("Tender item is missing linked indent item.");
        error.statusCode = 400;
        throw error;
      }

      const availableQuantity = asAmountNumber(tenderItem.case_item?.indent_item?.quantity);
      const alreadyTenderedQuantity = getAlreadyTenderedQuantity(tenderItem.case_item);
      const remainingQuantity = Math.max(availableQuantity - alreadyTenderedQuantity, 0);
      if (
        availableQuantity > 0 &&
        asAmountNumber(tenderItem.tender_quantity) > remainingQuantity
      ) {
        const error = new Error(
          `Tender quantity for ${tenderItem.case_item?.indent_item?.item_name || "item"} cannot exceed remaining quantity ${remainingQuantity}.`,
        );
        error.statusCode = 400;
        throw error;
      }
    }

    const itemQuantityTotal = tenderItems.reduce(
      (sum, item) => sum + asAmountNumber(item.tender_quantity),
      0,
    );
    const allocationQuantity =
      itemQuantityTotal > 0
        ? roundAmount(itemQuantityTotal)
        : payload.allocation_quantity === "" || payload.allocation_quantity == null
          ? null
          : normalizeAmount(payload.allocation_quantity);

    if (
      isSplitCase &&
      !allocationQuantity &&
      !(tenderType === "rate_contract" && rateContractType === "value_based")
    ) {
      const error = new Error("Split tender legs must capture quantity.");
      error.statusCode = 400;
      throw error;
    }

    return this.repository.withTransaction(async (transaction) => {
      const tender = await this.repository.create(
        {
          procurement_case_id: procurementCaseId,
          file_no: requireValue(payload, "file_no", "File number"),
          tender_reference_no: tenderIdentifiers.tender_reference_no,
          tender_type: tenderType,
          rate_contract_type:
            tenderType === "rate_contract" ? rateContractType : null,
          portal_type: portalType,
          tender_title: requireValue(payload, "tender_title", "Tender title"),
          portal_bid_no: tenderIdentifiers.portal_bid_no,
          portal_ra_no: tenderIdentifiers.portal_ra_no,
          portal_tender_id: tenderIdentifiers.portal_tender_id,
          leg_label: normalizeNullableText(payload.leg_label),
          allocation_quantity: allocationQuantity,
          tender_value: normalizeAmount(payload.tender_value),
          emd_exemption_policy: normalizeText(payload.emd_exemption_policy) || "none",
          emd_amount: normalizeAmount(payload.emd_amount),
          tender_fee_amount: normalizeAmount(payload.tender_fee_amount),
          bid_publish_date: normalizeDate(payload.bid_publish_date),
          bid_submission_date: normalizeDateTime(payload.bid_submission_date),
          bid_opening_date: normalizeDate(payload.bid_opening_date),
          current_submission_deadline:
            normalizeDateTime(payload.current_submission_deadline) ||
            normalizeDateTime(payload.bid_submission_date),
          status: normalizeText(payload.status) || "draft",
          document_path: normalizeNullableText(payload.document_path),
          remarks: normalizeNullableText(payload.remarks),
          location_scope: requireValue(payload, "location_scope", "Location scope"),
        },
        { transaction },
      );

      if (procurementCaseId) {
        await this.procurementCaseRepository.updateProcurementCaseStatusIfAllowed(
          procurementCaseId,
          "tender_created",
          ["open"],
          { transaction },
        );
      }

      if (tenderItems.length) {
        await this.repository.bulkCreateTenderItems(
          tenderItems.map((item) => ({
            tender_id: tender.id,
            procurement_case_item_id: item.procurement_case_item_id,
            indent_item_id: item.indent_item_id,
            tender_quantity: item.tender_quantity,
            tender_value: item.tender_value,
            unit: item.unit,
            remarks: item.remarks,
          })),
          { transaction },
        );
      }

      return tender;
    });
  }

  async createSubmissionExtension(tenderId, payload = {}) {
    const tender = await this.repository.findTenderWithVendorsForEmdGeneration(
      asId(tenderId, "Tender id"),
    );
    if (!tender) throw notFound("Tender not found.");

    if (Array.isArray(tender.vendors) && tender.vendors.length > 0) {
      const error = new Error(
        "Submission extension cannot be recorded after bid opening work has started.",
      );
      error.statusCode = 400;
      throw error;
    }

    const extendedUptoDateTime = normalizeDateTime(
      requireValue(payload, "extended_upto_date", "Extended upto date and time"),
    );
    const currentSubmissionDateValue = parseStoredDeadline(
      tender.current_submission_deadline || tender.bid_submission_date,
    );
    const previousSubmissionDate =
      currentSubmissionDateValue && !Number.isNaN(currentSubmissionDateValue.getTime())
        ? currentSubmissionDateValue
        : null;

    if (previousSubmissionDate && extendedUptoDateTime <= previousSubmissionDate) {
      const error = new Error("Extended upto date must be later than the current submission date.");
      error.statusCode = 400;
      throw error;
    }

    await this.repository.withTransaction(async (transaction) => {
      await this.repository.createSubmissionExtension(
        {
          tender_id: tender.id,
          previous_submission_date: previousSubmissionDate,
          extended_upto_date: extendedUptoDateTime,
          extension_reason: normalizeNullableText(payload.extension_reason),
          approval_reference: normalizeNullableText(payload.approval_reference),
        },
        { transaction },
      );

      await tender.update(
        {
          current_submission_deadline: extendedUptoDateTime,
        },
        { transaction },
      );
    });

    return this.getById(tender.id);
  }

  async addVendor(tenderId, payload = {}) {
    const tender_id = asId(tenderId || payload.tender_id, "Tender id");
    const firm_id = asId(payload.firm_id, "Firm id");

    const tender = await this.repository.findByPk(tender_id, []);
    if (!tender) {
      const error = new Error("Tender not found.");
      error.statusCode = 404;
      throw error;
    }

    const firm = await this.repository.findFirmByPk(firm_id);
    if (!firm) {
      const error = new Error("Firm not found.");
      error.statusCode = 404;
      throw error;
    }

    const existing = await this.repository.findTenderVendorByTenderAndFirm(tender_id, firm_id);
    if (existing) {
      const error = new Error("This firm is already added to the tender.");
      error.statusCode = 400;
      throw error;
    }

    await this.repository.withTransaction(async (transaction) => {
      const initialTechnicalStatus =
        normalizeText(payload.technical_status) || "pending";
      const initialCommercialStatus =
        normalizeText(payload.commercial_status) || "pending";
      const tenderVendor = await this.repository.createTenderVendor(
        {
          tender_id,
          firm_id,
          participation_status: normalizeText(payload.participation_status) || "participated",
          bid_submission_date: normalizeDateTime(payload.bid_submission_date),
          technical_status: initialTechnicalStatus,
          technical_status_updated_at:
            initialTechnicalStatus !== "pending" ? new Date() : null,
          technical_disqualification_reason: null,
          commercial_status: initialCommercialStatus,
          commercial_status_updated_at:
            initialCommercialStatus !== "pending" ? new Date() : null,
          commercial_disqualification_reason: null,
          is_l1: Boolean(payload.is_l1),
          final_quoted_amount: normalizeAmount(payload.final_quoted_amount),
          negotiated_amount: normalizeAmount(payload.negotiated_amount),
          loa_allocation_basis: normalizeNullableText(payload.loa_allocation_basis),
          loa_allocated_quantity: normalizeAmount(payload.loa_allocated_quantity),
          loa_allocated_amount: normalizeAmount(payload.loa_allocated_amount),
          loa_rc_issue_type: normalizeNullableText(payload.loa_rc_issue_type),
          loa_rc_issue_date: normalizeNullableDate(payload.loa_rc_issue_date),
          loa_rc_document_path: normalizeNullableText(payload.loa_rc_document_path),
          remarks: normalizeNullableText(payload.remarks),
        },
        { transaction },
      );

      const existingEmd = await this.repository.findTenderEmdByTenderVendorId(tenderVendor.id);
      if (!existingEmd) {
        await this.repository.createTenderEmdEntry(
          {
            tender_id,
            tender_vendor_id: tenderVendor.id,
            emd_required: true,
            emd_submission_status: "not_submitted",
            emd_exemption_status: "none",
            tender_fee_amount: normalizeAmount(tender.tender_fee_amount),
            emd_amount: normalizeAmount(tender.emd_amount),
            refund_status: "not_due",
          },
          { transaction },
        );
      }
    });

    return this.getById(tender_id);
  }

  async deleteVendor(tenderId, vendorId) {
    const tender_id = asId(tenderId, "Tender id");
    const vendor_id = asId(vendorId, "Tender vendor id");
    const vendor = await this.repository.findTenderVendorByPk(vendor_id);
    if (!vendor || Number(vendor.tender_id) !== tender_id) {
      throw notFound("Tender vendor not found.");
    }

    const technicalStatus = String(vendor.technical_status || "pending").toLowerCase();
    const commercialStatus = String(vendor.commercial_status || "pending").toLowerCase();
    if (technicalStatus !== "pending" || commercialStatus !== "pending") {
      const error = new Error(
        "Vendor can be deleted only during technical evaluation before any status is finalized.",
      );
      error.statusCode = 400;
      throw error;
    }

    const linkedPo = await this.repository.findPurchaseOrderByTenderAndFirm(
      tender_id,
      vendor.firm_id,
    );
    if (linkedPo) {
      const error = new Error(
        "Vendor cannot be deleted because a purchase order already exists for this tender and firm.",
      );
      error.statusCode = 400;
      throw error;
    }

    const negotiationCount =
      await this.repository.countCommitteeNegotiationEntriesByTenderVendor(vendor.id);
    if (negotiationCount > 0) {
      const error = new Error(
        "Vendor cannot be deleted because committee negotiation records already exist.",
      );
      error.statusCode = 400;
      throw error;
    }

    await this.repository.withTransaction(async (transaction) => {
      const emdEntry =
        vendor.emd_entry ||
        (await this.repository.findTenderEmdByTenderVendorId(vendor.id));
      if (emdEntry) {
        await this.repository.destroyTenderEmdEntry(emdEntry, { transaction });
      }

      await this.repository.destroyTenderVendor(vendor, { transaction });
    });

    return this.getById(tender_id);
  }

  async updateVendor(tenderId, vendorId, payload = {}) {
    const tender_id = asId(tenderId, "Tender id");
    const vendor_id = asId(vendorId, "Tender vendor id");
    const vendor = await this.repository.findTenderVendorByPk(vendor_id);
    if (!vendor || Number(vendor.tender_id) !== tender_id) {
      throw notFound("Tender vendor not found.");
    }
    const tender = await this.repository.findByPk(tender_id);
    if (!tender) throw notFound("Tender not found.");
    const tenderItems = Array.isArray(tender.items) ? tender.items : [];
    const tenderItemIds = new Set(tenderItems.map((item) => Number(item.id)));

    const mergedTechnicalStatus = payload.technical_status
      ? normalizeText(payload.technical_status)
      : vendor.technical_status;
    const mergedCommercialStatus = payload.commercial_status
      ? normalizeText(payload.commercial_status)
      : vendor.commercial_status;

    assertAllowed(mergedTechnicalStatus, TECHNICAL_STATUSES, "Technical status");
    assertAllowed(mergedCommercialStatus, COMMERCIAL_STATUSES, "Commercial status");

    const update = {};
    let commercialItemQuotes = null;
    let persistedItemRows = [];
    const allocationBasisInPayload = normalizeNullableText(
      payload.loa_allocation_basis,
    );
    if ("technical_status" in payload) {
      update.technical_status = mergedTechnicalStatus;
      if (mergedTechnicalStatus !== vendor.technical_status) {
        update.technical_status_updated_at = new Date();
      }
      update.technical_disqualification_reason = null;
    }
    if ("commercial_status" in payload) {
      update.commercial_status = mergedCommercialStatus;
      if (mergedCommercialStatus !== vendor.commercial_status) {
        update.commercial_status_updated_at = new Date();
      }
      update.commercial_disqualification_reason = null;
    }
    if ("commercial_item_quotes" in payload) {
      commercialItemQuotes = normalizeCommercialItemQuotes(
        payload.commercial_item_quotes,
      );
      const seenTenderItemIds = new Set();
      for (const quote of commercialItemQuotes) {
        const tenderItemId = Number(quote.tender_item_id);
        if (!tenderItemIds.has(tenderItemId)) {
          const error = new Error(
            "One or more quoted items do not belong to this tender.",
          );
          error.statusCode = 400;
          throw error;
        }
        if (seenTenderItemIds.has(tenderItemId)) {
          const error = new Error(
            "Each tender item quote can be entered only once per vendor.",
          );
          error.statusCode = 400;
          throw error;
        }
        seenTenderItemIds.add(tenderItemId);
      }

      persistedItemRows = commercialItemQuotes.filter(
        (quote) =>
          asAmountNumber(quote.quoted_amount) > 0 ||
          asAmountNumber(quote.negotiated_amount) > 0 ||
          asAmountNumber(quote.loa_allocated_quantity) > 0 ||
          asAmountNumber(quote.loa_allocated_amount) > 0 ||
          Boolean(normalizeNullableText(quote.make)) ||
          Boolean(normalizeNullableText(quote.model)) ||
          Boolean(normalizeNullableText(quote.remarks)),
      );
      const quotedRows = commercialItemQuotes.filter(
        (quote) => asAmountNumber(quote.quoted_amount) > 0,
      );
      if (
        mergedCommercialStatus === "qualified" &&
        tenderItems.length > 1 &&
        quotedRows.length !== tenderItems.length
      ) {
        const error = new Error(
          "Enter quoted price for each tender item before qualifying the vendor commercially.",
        );
        error.statusCode = 400;
        throw error;
      }

      update.final_quoted_amount = quotedRows.length
        ? normalizeAmount(
            quotedRows.reduce(
              (sum, quote) => sum + asAmountNumber(quote.quoted_amount),
              0,
            ),
          )
        : null;
      const negotiatedRows = commercialItemQuotes.filter(
        (quote) => asAmountNumber(quote.negotiated_amount) > 0,
      );
      if (negotiatedRows.length) {
        update.negotiated_amount = normalizeAmount(
          negotiatedRows.reduce(
            (sum, quote) => sum + asAmountNumber(quote.negotiated_amount),
            0,
          ),
        );
      }
      if (allocationBasisInPayload === "quantity") {
        const allocationRows = commercialItemQuotes.filter(
          (quote) => asAmountNumber(quote.loa_allocated_quantity) > 0,
        );
        if (allocationRows.length) {
          const allocatedByOtherVendors = new Map();
          (Array.isArray(tender.vendors) ? tender.vendors : [])
            .filter((entry) => Number(entry.id) !== Number(vendor.id))
            .forEach((entry) => {
              (Array.isArray(entry.commercial_item_quotes)
                ? entry.commercial_item_quotes
                : []
              ).forEach((quote) => {
                const tenderItemId = Number(quote.tender_item_id);
                allocatedByOtherVendors.set(
                  tenderItemId,
                  (allocatedByOtherVendors.get(tenderItemId) || 0) +
                    asAmountNumber(quote.loa_allocated_quantity),
                );
              });
            });

          for (const allocationRow of allocationRows) {
            const tenderItem = tenderItems.find(
              (item) => Number(item.id) === Number(allocationRow.tender_item_id),
            );
            const itemLimit = asAmountNumber(tenderItem?.tender_quantity);
            const usedByOtherVendors =
              allocatedByOtherVendors.get(Number(allocationRow.tender_item_id)) ||
              0;
            const requested = asAmountNumber(allocationRow.loa_allocated_quantity);
            if (itemLimit > 0 && usedByOtherVendors + requested > itemLimit) {
              const error = new Error(
                `${
                  tenderItem?.indent_item?.item_name || "Tender item"
                } allocation exceeds the tender quantity. Remaining allowable quantity is ${Math.max(
                  itemLimit - usedByOtherVendors,
                  0,
                )}.`,
              );
              error.statusCode = 400;
              throw error;
            }
          }
        }
        if (allocationRows.length) {
          update.loa_allocated_quantity = normalizeAmount(
            allocationRows.reduce(
              (sum, quote) => sum + asAmountNumber(quote.loa_allocated_quantity),
              0,
            ),
          );
        } else if ("loa_allocated_quantity" in payload) {
          update.loa_allocated_quantity = normalizeAmount(
            payload.loa_allocated_quantity,
          );
        }
      }
      if (allocationBasisInPayload === "amount") {
        const allocationRows = commercialItemQuotes.filter(
          (quote) => asAmountNumber(quote.loa_allocated_amount) > 0,
        );
        if (allocationRows.length) {
          const allocatedByOtherVendors = new Map();
          (Array.isArray(tender.vendors) ? tender.vendors : [])
            .filter((entry) => Number(entry.id) !== Number(vendor.id))
            .forEach((entry) => {
              (Array.isArray(entry.commercial_item_quotes)
                ? entry.commercial_item_quotes
                : []
              ).forEach((quote) => {
                const tenderItemId = Number(quote.tender_item_id);
                allocatedByOtherVendors.set(
                  tenderItemId,
                  (allocatedByOtherVendors.get(tenderItemId) || 0) +
                    asAmountNumber(quote.loa_allocated_amount),
                );
              });
            });

          for (const allocationRow of allocationRows) {
            const tenderItem = tenderItems.find(
              (item) => Number(item.id) === Number(allocationRow.tender_item_id),
            );
            const itemLimit = asAmountNumber(tenderItem?.tender_value);
            const usedByOtherVendors =
              allocatedByOtherVendors.get(Number(allocationRow.tender_item_id)) ||
              0;
            const requested = asAmountNumber(allocationRow.loa_allocated_amount);
            if (itemLimit > 0 && usedByOtherVendors + requested > itemLimit) {
              const error = new Error(
                `${
                  tenderItem?.indent_item?.item_name || "Tender item"
                } allocation exceeds the tender value. Remaining allowable value is ${Math.max(
                  itemLimit - usedByOtherVendors,
                  0,
                )}.`,
              );
              error.statusCode = 400;
              throw error;
            }
          }
        }
        if (allocationRows.length) {
          update.loa_allocated_amount = normalizeAmount(
            allocationRows.reduce(
              (sum, quote) => sum + asAmountNumber(quote.loa_allocated_amount),
              0,
            ),
          );
        } else if ("loa_allocated_amount" in payload) {
          update.loa_allocated_amount = normalizeAmount(
            payload.loa_allocated_amount,
          );
        }
      }
    }
    if ("final_quoted_amount" in payload && !commercialItemQuotes) {
      update.final_quoted_amount = normalizeAmount(payload.final_quoted_amount);
    }
    if ("negotiated_amount" in payload) update.negotiated_amount = normalizeAmount(payload.negotiated_amount);
    if ("is_l1" in payload) update.is_l1 = Boolean(payload.is_l1);
    if ("loa_allocation_basis" in payload) {
      const nextAllocationBasis = normalizeNullableText(payload.loa_allocation_basis);
      if (nextAllocationBasis) {
        const savedAllocation = await this.repository.findSavedLoaAllocationBasis(
          vendor.tender_id,
        );
        const savedBasis = normalizeNullableText(
          savedAllocation?.loa_allocation_basis,
        );
        if (savedBasis && savedBasis !== nextAllocationBasis) {
          const error = new Error(
            `Allocation basis is already frozen as ${savedBasis}. It cannot be changed.`,
          );
          error.statusCode = 400;
          throw error;
        }
      }
      update.loa_allocation_basis = nextAllocationBasis;
    }
    const nextAllocationScope =
      "loa_allocation_scope" in payload
        ? normalizeNullableText(payload.loa_allocation_scope)
        : null;
    if (nextAllocationScope) {
      assertAllowed(
        nextAllocationScope,
        LOA_ALLOCATION_SCOPES,
        "LOA allocation scope",
      );
      const savedScope = normalizeNullableText(tender?.loa_allocation_scope);
      if (savedScope && savedScope !== nextAllocationScope) {
        const error = new Error(
          `Allocation L1 consideration is already frozen as ${savedScope}. It cannot be changed.`,
        );
        error.statusCode = 400;
        throw error;
      }
    }
    if ("loa_allocated_quantity" in payload) update.loa_allocated_quantity = normalizeAmount(payload.loa_allocated_quantity);
    if ("loa_allocated_amount" in payload) update.loa_allocated_amount = normalizeAmount(payload.loa_allocated_amount);
    if ("loa_rc_issue_type" in payload) update.loa_rc_issue_type = normalizeNullableText(payload.loa_rc_issue_type);
    if ("loa_rc_issue_date" in payload) update.loa_rc_issue_date = normalizeNullableDate(payload.loa_rc_issue_date);
    if ("loa_rc_document_path" in payload) update.loa_rc_document_path = normalizeNullableText(payload.loa_rc_document_path);
    if ("pbg_basis" in payload) update.pbg_basis = normalizeNullableText(payload.pbg_basis);
    if ("pbg_percentage" in payload) update.pbg_percentage = normalizeAmount(payload.pbg_percentage);
    if ("pbg_additional_months" in payload) update.pbg_additional_months = payload.pbg_additional_months === "" || payload.pbg_additional_months == null ? null : Number(payload.pbg_additional_months);
    if ("remarks" in payload) update.remarks = normalizeNullableText(payload.remarks);

    await this.repository.withTransaction(async (transaction) => {
      if (commercialItemQuotes && allocationBasisInPayload && nextAllocationScope) {
        if (nextAllocationScope === "overall") {
          const overallL1VendorIds = buildOverallL1VendorIds(
            tender,
            vendor.id,
            commercialItemQuotes,
          );
          if (!overallL1VendorIds.has(Number(vendor.id))) {
            const error = new Error(
              "This vendor is not eligible for allocation under overall L1 consideration.",
            );
            error.statusCode = 400;
            throw error;
          }
        }

        if (nextAllocationScope === "item_wise") {
          const itemWiseEligibleItemIdsByVendorId =
            buildItemWiseL1ItemIdsByVendorId(
              tender,
              vendor.id,
              commercialItemQuotes,
            );
          const eligibleItemIds =
            itemWiseEligibleItemIdsByVendorId[Number(vendor.id)] || new Set();
          const invalidAllocationRow = commercialItemQuotes.find((quote) => {
            const requested =
              allocationBasisInPayload === "amount"
                ? asAmountNumber(quote.loa_allocated_amount)
                : asAmountNumber(quote.loa_allocated_quantity);
            return requested > 0 && !eligibleItemIds.has(Number(quote.tender_item_id));
          });

          if (invalidAllocationRow) {
            const tenderItem = tenderItems.find(
              (item) =>
                Number(item.id) === Number(invalidAllocationRow.tender_item_id),
            );
            const error = new Error(
              `${
                tenderItem?.indent_item?.item_name || "This tender item"
              } is not eligible for allocation for this vendor under item-wise L1 consideration.`,
            );
            error.statusCode = 400;
            throw error;
          }
        }
      }

      if (nextAllocationScope) {
        await this.repository.updateTender(
          tender,
          { loa_allocation_scope: nextAllocationScope },
          { transaction },
        );
      }

      await this.repository.updateTenderVendor(vendor, update, { transaction });

      if (commercialItemQuotes) {
        await this.repository.deleteTenderVendorItemQuotes(vendor.id, {
          transaction,
        });
        const vendorItemRows = persistedItemRows.map((quote) => ({
            tender_vendor_id: vendor.id,
            tender_item_id: quote.tender_item_id,
            quoted_amount: quote.quoted_amount,
            negotiated_amount: quote.negotiated_amount,
            loa_allocated_quantity: quote.loa_allocated_quantity,
            loa_allocated_amount: quote.loa_allocated_amount,
            make: quote.make,
            model: quote.model,
            remarks: quote.remarks,
          }));
        await this.repository.bulkCreateTenderVendorItemQuotes(vendorItemRows, {
          transaction,
        });
      }
    });
    return this.getById(tender_id);
  }

  async createVendorAllocationExtension(tenderId, vendorId, payload = {}) {
    const tender_id = asId(tenderId, "Tender id");
    const vendor_id = asId(vendorId, "Tender vendor id");
    const vendor = await this.repository.findTenderVendorByPk(vendor_id);
    if (!vendor || Number(vendor.tender_id) !== tender_id) {
      throw notFound("Tender vendor not found.");
    }

    const basis = normalizeText(payload.extension_basis || payload.basis);
    if (!["quantity", "amount"].includes(basis)) {
      const error = new Error("Extension basis must be quantity or amount.");
      error.statusCode = 400;
      throw error;
    }

    const commercialQuotes = Array.isArray(vendor?.commercial_item_quotes)
      ? vendor.commercial_item_quotes
      : [];
    const quoteByTenderItemId = new Map(
      commercialQuotes.map((quote) => [Number(quote.tender_item_id), quote]),
    );
    const items = (Array.isArray(payload.items) ? payload.items : [])
      .map((item, index) => {
        const tenderItemId = asId(
          item?.tender_item_id,
          `Extension item #${index + 1} tender item`,
        );
        const quote = quoteByTenderItemId.get(Number(tenderItemId));
        if (!quote) {
          const error = new Error("Extension item is not linked with this vendor.");
          error.statusCode = 400;
          throw error;
        }

        const extensionQuantity =
          basis === "quantity"
            ? item?.extension_quantity === "" || item?.extension_quantity == null
              ? null
              : normalizeAmount(item.extension_quantity)
            : null;
        const extensionAmount =
          basis === "amount"
            ? item?.extension_amount === "" || item?.extension_amount == null
              ? null
              : normalizeAmount(item.extension_amount)
            : null;

        if (
          basis === "quantity" &&
          (!extensionQuantity || asAmountNumber(extensionQuantity) <= 0)
        ) {
          return null;
        }
        if (
          basis === "amount" &&
          (!extensionAmount || asAmountNumber(extensionAmount) <= 0)
        ) {
          return null;
        }

        const negotiatedRate = asAmountNumber(
          quote?.negotiated_amount ?? quote?.quoted_amount,
        );
        return {
          tender_item_id: tenderItemId,
          extension_quantity,
          extension_amount:
            basis === "amount"
              ? extensionAmount
              : negotiatedRate > 0
                ? roundAmount(asAmountNumber(extensionQuantity) * negotiatedRate)
                : (() => {
                    const error = new Error(
                      "Negotiated item-wise rate is required before recording quantity extension.",
                    );
                    error.statusCode = 400;
                    throw error;
                  })(),
        };
      })
      .filter(Boolean);

    if (!items.length) {
      const error = new Error(
        basis === "amount"
          ? "Enter item-wise extension amount for at least one item."
          : "Enter item-wise extension quantity for at least one item.",
      );
      error.statusCode = 400;
      throw error;
    }

    await this.repository.withTransaction(async (transaction) => {
      const extensionQuantity = roundAmount(
        items.reduce(
          (sum, item) => sum + asAmountNumber(item.extension_quantity),
          0,
        ),
      );
      const extensionAmount = roundAmount(
        items.reduce((sum, item) => sum + asAmountNumber(item.extension_amount), 0),
      );
      const extension = await this.repository.createTenderVendorAllocationExtension(
        {
          tender_vendor_id: vendor.id,
          tender_id,
          firm_id: vendor.firm_id,
          extension_basis: basis,
          extension_quantity: extensionQuantity || null,
          extension_amount: extensionAmount || null,
          approval_reference: normalizeNullableText(payload.approval_reference),
          approval_date: normalizeNullableDate(payload.approval_date),
          document_path: normalizeNullableText(payload.document_path),
          remarks: normalizeNullableText(payload.remarks),
        },
        { transaction },
      );

      await this.repository.bulkCreateTenderVendorAllocationExtensionItems(
        items.map((item) => ({
          allocation_extension_id: extension.id,
          tender_item_id: item.tender_item_id,
          extension_quantity: item.extension_quantity,
          extension_amount: item.extension_amount,
        })),
        { transaction },
      );
    });

    return this.getById(tender_id);
  }

  async generateEmdEntries(tenderId) {
    const tender_id = asId(tenderId, "Tender id");
    const tender = await this.repository.findTenderWithVendorsForEmdGeneration(tender_id);
    if (!tender) throw notFound("Tender not found.");

    const result = await this.repository.withTransaction(async (transaction) => {
      const created = [];
      const skipped = [];

      for (const tenderVendor of tender.vendors || []) {
        if (tenderVendor.emd_entry) {
          skipped.push(tenderVendor.id);
          continue;
        }

        const firm = tenderVendor.firm;
        const isHaryanaMsme =
          Boolean(firm?.msme_no) &&
          String(firm?.msme_state || "").trim().toUpperCase() === "HARYANA";
        const exemptionStatus = isHaryanaMsme ? "full" : "none";

        const emd = await this.repository.createTenderEmdEntry(
          {
            tender_id,
            tender_vendor_id: tenderVendor.id,
            emd_required: !isHaryanaMsme,
            emd_submission_status: isHaryanaMsme ? "exempted" : "not_submitted",
            emd_exemption_status: exemptionStatus,
            emd_exemption_reason: isHaryanaMsme ? "Haryana MSME exemption" : null,
            tender_fee_amount: tender.tender_fee_amount,
            emd_amount: null,
            refund_status: "not_due",
          },
          { transaction },
        );
        created.push(emd);
      }

      return {
        createdCount: created.length,
        skippedCount: skipped.length,
      };
    });

    return {
      ...result,
      tender: await this.getById(tender_id),
    };
  }
}

module.exports = TenderService;
