"use strict";

const { Op } = require("sequelize");
const {
  Tender,
  TenderPbgSetup,
  TenderVendor,
  TenderVendorAllocationExtension,
  TenderVendorItemQuote,
  TenderItem,
  PurchaseOrder,
  PurchaseOrderItem,
  PbgEntry,
  PbgObligation,
  PbgReceiptAllocation,
  Firm,
  sequelize,
} = require("../../models");
const {
  asAmountNumber,
  normalizeAmount,
  normalizeNullableText,
  normalizeText,
  notFound,
  requireValue,
  roundAmount,
} = require("../utils/procurement-domain");

const PBG_MODES = new Set(["po_wise", "contract_value", "hybrid"]);
const ACTIVE_RECEIPT_STATUSES = new Set(["active", "extended"]);
const ACTIVE_OBLIGATION_STATUSES = new Set(["active"]);

const parseWarrantyMonths = (value) => {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return 0;
  const yearMatch = text.match(/(\d+(?:\.\d+)?)\s*years?/);
  const monthMatch = text.match(/(\d+(?:\.\d+)?)\s*months?/);
  return roundAmount(
    (yearMatch ? Number(yearMatch[1]) * 12 : 0) +
      (monthMatch ? Number(monthMatch[1]) : 0),
  );
};

const addMonths = (dateValue, months) => {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  date.setMonth(date.getMonth() + Number(months || 0));
  return date;
};

const addDays = (dateValue, days) => {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + Number(days || 0));
  return date;
};

const formatDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const maxDateOnly = (...values) => {
  const valid = values
    .map((value) => (value ? new Date(value) : null))
    .filter((date) => date && !Number.isNaN(date.getTime()));
  if (!valid.length) return null;
  return formatDateOnly(
    new Date(Math.max(...valid.map((date) => date.getTime()))),
  );
};

const minDateOnly = (...values) => {
  const valid = values
    .map((value) => (value ? new Date(value) : null))
    .filter((date) => date && !Number.isNaN(date.getTime()));
  if (!valid.length) return null;
  return formatDateOnly(
    new Date(Math.min(...valid.map((date) => date.getTime()))),
  );
};

const receiptCoverageUpto = (receipt) =>
  maxDateOnly(
    receipt?.valid_upto || null,
    receipt?.claim_period_upto || null,
    receipt?.invocation_upto || null,
  );

const computeAllocatedCoverageUpto = (requiredAmount, receiptAllocations = []) => {
  const required = asAmountNumber(requiredAmount);
  if (required <= 0) return null;
  const rankedAllocations = (Array.isArray(receiptAllocations)
    ? receiptAllocations
    : []
  )
    .map((allocation) => ({
      allocatedAmount: asAmountNumber(allocation?.allocated_amount),
      coverageUpto: receiptCoverageUpto(allocation?.pbg_receipt),
      status: String(allocation?.pbg_receipt?.status || "").toLowerCase(),
    }))
    .filter(
      (allocation) =>
        allocation.allocatedAmount > 0 &&
        allocation.coverageUpto &&
        ACTIVE_RECEIPT_STATUSES.has(allocation.status),
    )
    .sort((left, right) =>
      new Date(right.coverageUpto).getTime() - new Date(left.coverageUpto).getTime(),
    );

  let runningCoveredAmount = 0;
  for (const allocation of rankedAllocations) {
    runningCoveredAmount = roundAmount(
      runningCoveredAmount + allocation.allocatedAmount,
    );
    if (runningCoveredAmount >= required) {
      return allocation.coverageUpto;
    }
  }
  return null;
};

const computeAnyAllocatedCoverageUpto = (receiptAllocations = []) =>
  maxDateOnly(
    ...(Array.isArray(receiptAllocations) ? receiptAllocations : [])
      .map((allocation) => {
        const allocatedAmount = asAmountNumber(allocation?.allocated_amount);
        const status = String(allocation?.pbg_receipt?.status || "").toLowerCase();
        if (
          allocatedAmount <= 0 ||
          !ACTIVE_RECEIPT_STATUSES.has(status)
        ) {
          return null;
        }
        return receiptCoverageUpto(allocation?.pbg_receipt);
      })
      .filter(Boolean),
  );

const daysBetween = (fromDate, toDate) => {
  if (!fromDate || !toDate) return null;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
};

const buildVendorBaseContractValue = (vendor) => {
  const basis = String(vendor?.loa_allocation_basis || "").toLowerCase();
  if (basis === "amount") {
    return roundAmount(vendor?.loa_allocated_amount);
  }
  const itemQuotes = Array.isArray(vendor?.commercial_item_quotes)
    ? vendor.commercial_item_quotes
    : [];
  const itemValue = itemQuotes.reduce((sum, quote) => {
    const qty = asAmountNumber(quote?.loa_allocated_quantity);
    const rate = asAmountNumber(
      quote?.negotiated_amount ?? quote?.quoted_amount ?? 0,
    );
    return sum + qty * rate;
  }, 0);
  if (itemValue > 0) return roundAmount(itemValue);
  return 0;
};

const isVendorDisqualifiedForPbg = (vendor) =>
  String(vendor?.technical_status || "").toLowerCase() === "disqualified" ||
  String(vendor?.commercial_status || "").toLowerCase() === "disqualified";

const hasVendorPbgFootprint = (vendor, purchaseOrders = [], receipts = []) => {
  if (!vendor) return false;
  const baseContractValue = buildVendorBaseContractValue(vendor);
  if (baseContractValue > 0) return true;
  const hasExtension = (Array.isArray(vendor?.allocation_extensions)
    ? vendor.allocation_extensions
    : []
  ).some((entry) =>
    (Array.isArray(entry?.items) ? entry.items : []).some(
      (item) =>
        asAmountNumber(item?.extension_amount) > 0 ||
        asAmountNumber(item?.extension_quantity) > 0,
    ),
  );
  if (hasExtension) return true;
  if (
    purchaseOrders.some((po) => Number(po?.firm_id) === Number(vendor?.firm_id))
  ) {
    return true;
  }
  if (receipts.some((receipt) => Number(receipt?.firm_id) === Number(vendor?.firm_id))) {
    return true;
  }
  return false;
};

const buildExtensionReferenceValue = (extension) => {
  const items = Array.isArray(extension?.items) ? extension.items : [];
  if (items.length) {
    return roundAmount(
      items.reduce(
        (sum, item) => sum + asAmountNumber(item?.extension_amount),
        0,
      ),
    );
  }
  if (String(extension?.extension_basis || "").toLowerCase() === "amount") {
    return roundAmount(extension?.extension_amount);
  }
  return 0;
};

const buildPoWarrantyCoverage = (purchaseOrder, setup) => {
  const anchorDate = formatDateOnly(purchaseOrder?.warranty_start_date);
  const warrantyMonths = parseWarrantyMonths(purchaseOrder?.warranty_period);
  if (!anchorDate || warrantyMonths <= 0) {
    return {
      warrantyAnchorDate: anchorDate,
      requiredValidUptoFinal: null,
      requiredValidUptoProvisional: null,
      additionalClaimUpto: null,
      validityPending: true,
    };
  }
  const warrantyEnd = addMonths(anchorDate, warrantyMonths);
  const claimUpto = addDays(
    addMonths(warrantyEnd, Number(setup?.additional_claim_months || 0)),
    Number(setup?.additional_claim_days || 0),
  );
  const formattedClaimUpto = formatDateOnly(claimUpto);
  return {
    warrantyAnchorDate: anchorDate,
    requiredValidUptoFinal: formattedClaimUpto,
    requiredValidUptoProvisional: formattedClaimUpto,
    additionalClaimUpto: formattedClaimUpto,
    validityPending: false,
  };
};

class PbgEngineService {
  async getTenderSetup(tenderId, options = {}) {
    const setup =
      (await TenderPbgSetup.findOne({
        where: { tender_id: tenderId },
        transaction: options.transaction,
      })) || null;
    return (
      setup || {
        tender_id: tenderId,
        pbg_mode: "po_wise",
        default_pbg_percentage: null,
        additional_claim_months: 6,
        additional_claim_days: 0,
        warning_before_days: 30,
        remarks: null,
      }
    );
  }

  async saveTenderSetup(tenderId, payload = {}) {
    const tender = await Tender.findByPk(Number(tenderId));
    if (!tender) throw notFound("Tender not found.");

    const pbgMode = normalizeText(payload.pbg_mode) || "po_wise";
    if (!PBG_MODES.has(pbgMode)) {
      const error = new Error("PBG mode is invalid.");
      error.statusCode = 400;
      throw error;
    }

    return sequelize.transaction(async (transaction) => {
      const existing = await TenderPbgSetup.findOne({
        where: { tender_id: tender.id },
        transaction,
      });
      const update = {
        tender_id: tender.id,
        pbg_mode: pbgMode,
        default_pbg_percentage: null,
        additional_claim_months:
          payload.additional_claim_months === "" ||
          payload.additional_claim_months == null
            ? 0
            : Number(payload.additional_claim_months),
        additional_claim_days: 0,
        warning_before_days: 30,
        remarks: normalizeNullableText(payload.remarks),
      };

      if (existing) {
        await existing.update(update, { transaction });
      } else {
        await TenderPbgSetup.create(update, { transaction });
      }

      const vendorRows = Array.isArray(payload.vendor_setups)
        ? payload.vendor_setups
        : [];
      for (const row of vendorRows) {
        const vendor = await TenderVendor.findOne({
          where: {
            id: Number(row.vendor_id),
            tender_id: tender.id,
          },
          transaction,
        });
        if (!vendor) continue;
        if (
          row.pbg_percentage !== "" &&
          row.pbg_percentage != null &&
          asAmountNumber(row.pbg_percentage) <= 0
        ) {
          const error = new Error("Vendor PBG percentage must be greater than zero.");
          error.statusCode = 400;
          throw error;
        }
        await vendor.update(
          {
            pbg_percentage:
              row.pbg_percentage === "" || row.pbg_percentage == null
                ? null
                : normalizeAmount(row.pbg_percentage),
          },
          { transaction },
        );
      }

      await this.syncTenderObligations(tender.id, { transaction });
      return this.getTenderEngine(tender.id, { transaction });
    });
  }

  async loadTenderForEngine(tenderId, options = {}) {
    const tender = await Tender.findByPk(Number(tenderId), {
      transaction: options.transaction,
      include: [
        { model: TenderPbgSetup, as: "pbg_setup" },
        {
          model: TenderVendor,
          as: "vendors",
          separate: true,
          order: [["id", "ASC"]],
          include: [
            { model: Firm, as: "firm" },
            {
              model: TenderVendorAllocationExtension,
              as: "allocation_extensions",
              separate: true,
              order: [["approval_date", "ASC"], ["id", "ASC"]],
              include: [
                {
                  association: "items",
                  separate: true,
                  order: [["id", "ASC"]],
                  include: [{ model: TenderItem, as: "tender_item" }],
                },
              ],
            },
            {
              model: TenderVendorItemQuote,
              as: "commercial_item_quotes",
              separate: true,
              order: [["id", "ASC"]],
              include: [{ model: TenderItem, as: "tender_item" }],
            },
          ],
        },
        {
          model: PurchaseOrder,
          as: "purchase_orders",
          separate: true,
          order: [["po_date", "ASC"], ["id", "ASC"]],
          include: [
            { model: PurchaseOrderItem, as: "items", separate: true, order: [["id", "ASC"]] },
            { model: PbgEntry, as: "pbg_entries" },
            { model: Firm, as: "firm" },
          ],
        },
        {
          model: PbgObligation,
          as: "pbg_obligations",
          separate: true,
          order: [["id", "ASC"]],
          include: [
            { model: Firm, as: "firm" },
            { model: PurchaseOrder, as: "purchase_order", required: false },
            {
              model: PbgReceiptAllocation,
              as: "receipt_allocations",
              separate: true,
              include: [{ model: PbgEntry, as: "pbg_receipt" }],
            },
          ],
        },
        {
          model: PbgEntry,
          as: "pbg_receipts",
          separate: true,
          order: [["id", "DESC"]],
          include: [
            { model: Firm, as: "firm" },
            { model: PurchaseOrder, as: "purchase_order", required: false },
            {
              model: PbgReceiptAllocation,
              as: "receipt_allocations",
              separate: true,
            },
          ],
        },
      ],
    });

    if (!tender) throw notFound("Tender not found.");
    return tender;
  }

  buildDesiredObligations(tender, setup) {
    const obligations = [];
    const mode = String(setup?.pbg_mode || "po_wise").toLowerCase();
    const purchaseOrders = Array.isArray(tender?.purchase_orders)
      ? tender.purchase_orders
      : [];
    const receipts = Array.isArray(tender?.pbg_receipts) ? tender.pbg_receipts : [];

    for (const vendor of tender?.vendors || []) {
      if (isVendorDisqualifiedForPbg(vendor)) continue;
      if (!hasVendorPbgFootprint(vendor, purchaseOrders, receipts)) continue;
      const vendorPercentage = asAmountNumber(vendor?.pbg_percentage);
      if (vendorPercentage <= 0) continue;

      const vendorPurchaseOrders = purchaseOrders.filter(
        (po) => Number(po?.firm_id) === Number(vendor?.firm_id),
      );
      const baseContractValue = buildVendorBaseContractValue(vendor);

      if (["contract_value", "hybrid"].includes(mode) && baseContractValue > 0) {
        obligations.push({
          tender_id: tender.id,
          tender_vendor_id: vendor.id,
          firm_id: vendor.firm_id,
          purchase_order_id: null,
          obligation_type: "contract",
          coverage_mode: mode === "hybrid" ? "base_contract" : "contract_value",
          source_reference: "base_contract",
          source_reference_date: null,
          reference_value: baseContractValue,
          pbg_percentage: vendorPercentage,
          required_amount: roundAmount((baseContractValue * vendorPercentage) / 100),
          ...this.buildVendorContractValidity(vendorPurchaseOrders, setup),
          extension_reference_no: null,
          extension_reference_date: null,
          extension_document_path: null,
          status: "active",
          remarks: null,
        });
      }

      const extensions = Array.isArray(vendor?.allocation_extensions)
        ? vendor.allocation_extensions
        : [];
      for (const extension of extensions) {
        const extensionValue = buildExtensionReferenceValue(extension);
        if (extensionValue <= 0) continue;
        obligations.push({
          tender_id: tender.id,
          tender_vendor_id: vendor.id,
          firm_id: vendor.firm_id,
          purchase_order_id: null,
          obligation_type: "extension",
          coverage_mode:
            mode === "hybrid" ? "po_extension" : "contract_extension",
          source_reference: `allocation_extension:${extension.id}`,
          source_reference_date: extension.approval_date || null,
          reference_value: extensionValue,
          pbg_percentage: vendorPercentage,
          required_amount: roundAmount((extensionValue * vendorPercentage) / 100),
          ...this.buildVendorContractValidity(vendorPurchaseOrders, setup),
          extension_reference_no: extension.approval_reference || null,
          extension_reference_date: extension.approval_date || null,
          extension_document_path: extension.document_path || null,
          status: "active",
          remarks: extension.remarks || null,
        });
      }

      if (mode === "po_wise") {
        for (const purchaseOrder of vendorPurchaseOrders) {
          const validity = buildPoWarrantyCoverage(purchaseOrder, setup);
          obligations.push({
            tender_id: tender.id,
            tender_vendor_id: vendor.id,
            firm_id: vendor.firm_id,
            purchase_order_id: purchaseOrder.id,
            obligation_type: "po",
            coverage_mode: "po_wise",
            source_reference: `po:${purchaseOrder.id}`,
            source_reference_date: purchaseOrder.po_date,
            reference_value: asAmountNumber(purchaseOrder.po_value),
            pbg_percentage: vendorPercentage,
            required_amount: roundAmount(
              (asAmountNumber(purchaseOrder.po_value) * vendorPercentage) / 100,
            ),
            warranty_anchor_date: validity.warrantyAnchorDate,
            required_valid_upto_provisional:
              validity.requiredValidUptoProvisional,
            required_valid_upto_final: validity.requiredValidUptoFinal,
            additional_claim_upto: validity.additionalClaimUpto,
            extension_reference_no: null,
            extension_reference_date: null,
            extension_document_path: null,
            status: "active",
            remarks: null,
          });
        }
      }

      if (mode === "hybrid") {
        const contractCoverage = baseContractValue;
        let runningPoValue = 0;
        let previousExcess = 0;
        for (const purchaseOrder of vendorPurchaseOrders) {
          runningPoValue += asAmountNumber(purchaseOrder.po_value);
          const currentExcess = Math.max(runningPoValue - contractCoverage, 0);
          const excessForThisPo = roundAmount(currentExcess - previousExcess);
          previousExcess = currentExcess;
          if (excessForThisPo <= 0) continue;
          const validity = buildPoWarrantyCoverage(purchaseOrder, setup);
          obligations.push({
            tender_id: tender.id,
            tender_vendor_id: vendor.id,
            firm_id: vendor.firm_id,
            purchase_order_id: purchaseOrder.id,
            obligation_type: "po",
            coverage_mode: "hybrid_po_excess",
            source_reference: `hybrid_po_excess:${purchaseOrder.id}`,
            source_reference_date: purchaseOrder.po_date,
            reference_value: excessForThisPo,
            pbg_percentage: vendorPercentage,
            required_amount: roundAmount(
              (excessForThisPo * vendorPercentage) / 100,
            ),
            warranty_anchor_date: validity.warrantyAnchorDate,
            required_valid_upto_provisional:
              validity.requiredValidUptoProvisional,
            required_valid_upto_final: validity.requiredValidUptoFinal,
            additional_claim_upto: validity.additionalClaimUpto,
            extension_reference_no: null,
            extension_reference_date: null,
            extension_document_path: null,
            status: "active",
            remarks: null,
          });
        }
      }
    }

    return obligations;
  }

  buildVendorContractValidity(vendorPurchaseOrders, setup) {
    const coverageDates = vendorPurchaseOrders.map((po) =>
      buildPoWarrantyCoverage(po, setup),
    );
    const finalDate = maxDateOnly(
      ...coverageDates.map((row) => row.requiredValidUptoFinal),
    );
    const provisionalDate = maxDateOnly(
      ...coverageDates.map((row) => row.requiredValidUptoProvisional),
    );
    const anchorDate = maxDateOnly(
      ...coverageDates.map((row) => row.warrantyAnchorDate),
    );
    return {
      warranty_anchor_date: anchorDate,
      required_valid_upto_provisional: provisionalDate,
      required_valid_upto_final: finalDate,
      additional_claim_upto: finalDate,
    };
  }

  async syncTenderObligations(tenderId, options = {}) {
    const execute = async (transaction) => {
      const tender = await this.loadTenderForEngine(tenderId, { transaction });
      const setup = tender?.pbg_setup || (await this.getTenderSetup(tenderId, { transaction }));
      const desiredRows = this.buildDesiredObligations(tender, setup);
      const existingRows = await PbgObligation.findAll({
        where: { tender_id: tender.id },
        transaction,
      });

      const existingByKey = new Map(
        existingRows.map((row) => [
          [
            row.firm_id,
            row.purchase_order_id || 0,
            row.coverage_mode,
            row.source_reference || "",
          ].join(":"),
          row,
        ]),
      );
      const matchedKeys = new Set();

      for (const row of desiredRows) {
        const key = [
          row.firm_id,
          row.purchase_order_id || 0,
          row.coverage_mode,
          row.source_reference || "",
        ].join(":");
        matchedKeys.add(key);
        const existing = existingByKey.get(key);
        if (existing) {
          await existing.update(row, { transaction });
        } else {
          await PbgObligation.create(row, { transaction });
        }
      }

      for (const existing of existingRows) {
        const key = [
          existing.firm_id,
          existing.purchase_order_id || 0,
          existing.coverage_mode,
          existing.source_reference || "",
        ].join(":");
        if (matchedKeys.has(key)) continue;
        await existing.update({ status: "cancelled" }, { transaction });
      }

      await this.rebuildReceiptAllocations(tender.id, { transaction });
    };

    if (options.transaction) {
      await execute(options.transaction);
      return;
    }
    await sequelize.transaction(execute);
  }

  async rebuildReceiptAllocations(tenderId, options = {}) {
    const obligations = await PbgObligation.findAll({
      where: { tender_id: tenderId },
      transaction: options.transaction,
      order: [["firm_id", "ASC"], ["source_reference_date", "ASC"], ["id", "ASC"]],
    });
    const receipts = await PbgEntry.findAll({
      where: { tender_id: tenderId },
      transaction: options.transaction,
      order: [["issue_date", "ASC"], ["id", "ASC"]],
    });

    const obligationIds = obligations.map((row) => Number(row.id)).filter(Boolean);
    const receiptIds = receipts.map((row) => Number(row.id)).filter(Boolean);
    if (obligationIds.length || receiptIds.length) {
      await PbgReceiptAllocation.destroy({
        where: {
          [Op.or]: [
            obligationIds.length ? { pbg_obligation_id: { [Op.in]: obligationIds } } : null,
            receiptIds.length ? { pbg_entry_id: { [Op.in]: receiptIds } } : null,
          ].filter(Boolean),
        },
        transaction: options.transaction,
      });
    }

    const activeObligations = obligations.filter((row) =>
      ACTIVE_OBLIGATION_STATUSES.has(String(row.status || "").toLowerCase()),
    );
    const activeReceipts = receipts.filter((row) =>
      ACTIVE_RECEIPT_STATUSES.has(String(row.status || "").toLowerCase()),
    );

    const receiptRemaining = new Map(
      activeReceipts.map((row) => [Number(row.id), asAmountNumber(row.pbg_amount)]),
    );
    const rowsToCreate = [];

    for (const obligation of activeObligations) {
      let remainingRequired = asAmountNumber(obligation.required_amount);
      const eligibleReceipts = activeReceipts
        .filter((receipt) => Number(receipt.firm_id) === Number(obligation.firm_id))
        .sort((a, b) => {
          const aSamePo =
            Number(a.po_id || 0) === Number(obligation.purchase_order_id || 0)
              ? -1
              : 0;
          const bSamePo =
            Number(b.po_id || 0) === Number(obligation.purchase_order_id || 0)
              ? -1
              : 0;
          return aSamePo - bSamePo || Number(a.id) - Number(b.id);
        });

      for (const receipt of eligibleReceipts) {
        if (remainingRequired <= 0) break;
        const available = asAmountNumber(receiptRemaining.get(Number(receipt.id)));
        if (available <= 0) continue;
        const allocatedAmount = roundAmount(Math.min(available, remainingRequired));
        if (allocatedAmount <= 0) continue;
        receiptRemaining.set(
          Number(receipt.id),
          roundAmount(available - allocatedAmount),
        );
        remainingRequired = roundAmount(remainingRequired - allocatedAmount);
        rowsToCreate.push({
          pbg_entry_id: receipt.id,
          pbg_obligation_id: obligation.id,
          allocated_amount: allocatedAmount,
        });
      }
    }

    if (rowsToCreate.length) {
      await PbgReceiptAllocation.bulkCreate(rowsToCreate, {
        transaction: options.transaction,
      });
    }
  }

  async ensureTenderEngine(tenderId, options = {}) {
    await this.syncTenderObligations(tenderId, options);
    return this.getTenderEngine(tenderId, options);
  }

  buildVendorProfiles(tender, setup) {
    const obligations = Array.isArray(tender?.pbg_obligations)
      ? tender.pbg_obligations
      : [];
    const receipts = Array.isArray(tender?.pbg_receipts) ? tender.pbg_receipts : [];
    const today = new Date().toISOString().slice(0, 10);
    const purchaseOrders = Array.isArray(tender?.purchase_orders)
      ? tender.purchase_orders
      : [];
    return (tender?.vendors || [])
      .filter((vendor) => !isVendorDisqualifiedForPbg(vendor))
      .filter((vendor) => hasVendorPbgFootprint(vendor, purchaseOrders, receipts))
      .map((vendor) => {
      const vendorObligations = obligations.filter(
        (row) =>
          Number(row.firm_id) === Number(vendor.firm_id) &&
          ACTIVE_OBLIGATION_STATUSES.has(String(row.status || "").toLowerCase()),
      );
      const vendorReceipts = receipts.filter(
        (row) => Number(row.firm_id) === Number(vendor.firm_id),
      );
      const requiredAmount = roundAmount(
        vendorObligations.reduce(
          (sum, row) => sum + asAmountNumber(row.required_amount),
          0,
        ),
      );
      const receivedAmount = roundAmount(
        vendorReceipts
          .filter((row) =>
            ACTIVE_RECEIPT_STATUSES.has(String(row.status || "").toLowerCase()),
          )
          .reduce((sum, row) => sum + asAmountNumber(row.pbg_amount), 0),
      );
      const shortAmount = roundAmount(Math.max(requiredAmount - receivedAmount, 0));
      const obligationCoverageRows = vendorObligations.map((row) => {
        const requiredValidUpto =
          row.required_valid_upto_final || row.required_valid_upto_provisional;
        const fullCoveredUpto = computeAllocatedCoverageUpto(
          row.required_amount,
          row.receipt_allocations,
        );
        const anyCoveredUpto = computeAnyAllocatedCoverageUpto(
          row.receipt_allocations,
        );
        const timeShort = Boolean(
          requiredValidUpto &&
            (!fullCoveredUpto ||
              new Date(fullCoveredUpto) < new Date(requiredValidUpto)),
        );
        return {
          requiredValidUpto,
          fullCoveredUpto,
          anyCoveredUpto,
          timeShort,
        };
      });
      const latestRequiredFinal = maxDateOnly(
        ...vendorObligations.map((row) => row.required_valid_upto_final),
      );
      const latestRequiredProvisional = maxDateOnly(
        ...vendorObligations.map((row) => row.required_valid_upto_provisional),
      );
      const finalRequiredDate = latestRequiredFinal || latestRequiredProvisional;
      const currentCoveredUpto = obligationCoverageRows.length
        ? obligationCoverageRows.some((row) => !row.fullCoveredUpto)
          ? minDateOnly(
              ...obligationCoverageRows.map(
                (row) => row.anyCoveredUpto || row.fullCoveredUpto,
              ),
            )
          : minDateOnly(
              ...obligationCoverageRows.map((row) => row.fullCoveredUpto),
            )
        : null;
      const timeShort = obligationCoverageRows.some((row) => row.timeShort);
      const daysLeft = currentCoveredUpto ? daysBetween(today, currentCoveredUpto) : null;
      const expiringWithinWarning =
        daysLeft !== null && daysLeft <= Number(setup?.warning_before_days || 30);
      const shortStatus =
        shortAmount > 0 && timeShort
          ? "both"
          : shortAmount > 0
            ? "short_amount"
            : timeShort
              ? "short_validity"
              : "ok";

      return {
        vendor_id: vendor.id,
        firm_id: vendor.firm_id,
        firm: vendor.firm,
        pbg_percentage:
          asAmountNumber(vendor?.pbg_percentage) || 0,
        allocation_basis: vendor?.loa_allocation_basis || null,
        base_contract_quantity: asAmountNumber(vendor?.loa_allocated_quantity),
        base_contract_value: buildVendorBaseContractValue(vendor),
        contract_pbg_required_amount: roundAmount(
          vendorObligations
            .filter((row) => row.obligation_type === "contract")
            .reduce((sum, row) => sum + asAmountNumber(row.required_amount), 0),
        ),
        contract_pbg_received_amount: roundAmount(
          vendorObligations
            .filter((row) => row.obligation_type === "contract")
            .reduce((sum, row) => {
              const allocated = Array.isArray(row.receipt_allocations)
                ? row.receipt_allocations.reduce(
                    (innerSum, allocation) =>
                      innerSum + asAmountNumber(allocation.allocated_amount),
                    0,
                  )
                : 0;
              return sum + allocated;
            }, 0),
        ),
        po_pbg_required_amount: roundAmount(
          vendorObligations
            .filter((row) => row.obligation_type === "po")
            .reduce((sum, row) => sum + asAmountNumber(row.required_amount), 0),
        ),
        po_pbg_received_amount: roundAmount(
          vendorObligations
            .filter((row) => row.obligation_type === "po")
            .reduce((sum, row) => {
              const allocated = Array.isArray(row.receipt_allocations)
                ? row.receipt_allocations.reduce(
                    (innerSum, allocation) =>
                      innerSum + asAmountNumber(allocation.allocated_amount),
                    0,
                  )
                : 0;
              return sum + allocated;
            }, 0),
        ),
        total_required_amount: requiredAmount,
        total_received_amount: receivedAmount,
        total_short_amount: shortAmount,
        short_status: shortStatus,
        required_valid_upto: finalRequiredDate,
        current_covered_upto: currentCoveredUpto,
        days_left: daysLeft,
        expiring_within_warning: expiringWithinWarning,
        time_short: timeShort,
      };
    });
  }

  async getTenderEngine(tenderId, options = {}) {
    const tender = await this.loadTenderForEngine(tenderId, options);
    const setup = tender?.pbg_setup || (await this.getTenderSetup(tenderId, options));
    const vendorProfiles = this.buildVendorProfiles(tender, setup);
    return {
      setup: {
        tender_id: tender.id,
        pbg_mode: setup.pbg_mode || "po_wise",
        default_pbg_percentage:
          setup.default_pbg_percentage == null
            ? null
            : Number(setup.default_pbg_percentage),
        additional_claim_months: Number(setup.additional_claim_months || 0),
        additional_claim_days: Number(setup.additional_claim_days || 0),
        warning_before_days: Number(setup.warning_before_days || 30),
        remarks: setup.remarks || "",
      },
      vendor_profiles: vendorProfiles,
      obligations: (tender?.pbg_obligations || []).map((row) => ({
        id: row.id,
        tender_vendor_id: row.tender_vendor_id,
        firm_id: row.firm_id,
        purchase_order_id: row.purchase_order_id,
        obligation_type: row.obligation_type,
        coverage_mode: row.coverage_mode,
        reference_value: asAmountNumber(row.reference_value),
        pbg_percentage: asAmountNumber(row.pbg_percentage),
        required_amount: asAmountNumber(row.required_amount),
        required_valid_upto_provisional: row.required_valid_upto_provisional,
        required_valid_upto_final: row.required_valid_upto_final,
        warranty_anchor_date: row.warranty_anchor_date,
        additional_claim_upto: row.additional_claim_upto,
        source_reference: row.source_reference,
        source_reference_date: row.source_reference_date,
        extension_reference_no: row.extension_reference_no,
        extension_reference_date: row.extension_reference_date,
        extension_document_path: row.extension_document_path,
        status: row.status,
        remarks: row.remarks,
        firm: row.firm,
        purchase_order: row.purchase_order,
        allocated_amount: roundAmount(
          (Array.isArray(row.receipt_allocations) ? row.receipt_allocations : []).reduce(
            (sum, allocation) => sum + asAmountNumber(allocation.allocated_amount),
            0,
          ),
        ),
        short_amount: roundAmount(
          Math.max(
            asAmountNumber(row.required_amount) -
              (Array.isArray(row.receipt_allocations)
                ? row.receipt_allocations.reduce(
                    (sum, allocation) =>
                      sum + asAmountNumber(allocation.allocated_amount),
                    0,
                  )
                : 0),
            0,
          ),
        ),
      })),
      receipts: (tender?.pbg_receipts || []).map((row) => ({
        id: row.id,
        tender_id: row.tender_id,
        po_id: row.po_id,
        firm_id: row.firm_id,
        pbg_amount: asAmountNumber(row.pbg_amount),
        pbg_percentage: asAmountNumber(row.pbg_percentage),
        submission_mode: row.submission_mode,
        status: row.status,
        bank_guarantee_no: row.bank_guarantee_no,
        issuing_bank_name: row.issuing_bank_name,
        issue_date: row.issue_date,
        valid_upto: row.valid_upto,
        claim_period_upto: row.claim_period_upto,
        invocation_upto: row.invocation_upto,
        document_path: row.document_path,
        refund_status: row.refund_status,
        remarks: row.remarks,
        firm: row.firm,
        purchase_order: row.purchase_order,
      })),
      compliance: vendorProfiles.map((row) => ({
        firm_id: row.firm_id,
        firm_name: row.firm?.firm_name || "NA",
        pbg_mode: setup.pbg_mode || "po_wise",
        required_amount: row.total_required_amount,
        received_amount: row.total_received_amount,
        short_amount: row.total_short_amount,
        required_valid_upto: row.required_valid_upto,
        current_covered_upto: row.current_covered_upto,
        days_left: row.days_left,
        expiring_within_warning: row.expiring_within_warning,
        status: row.short_status,
      })),
    };
  }
}

module.exports = PbgEngineService;
