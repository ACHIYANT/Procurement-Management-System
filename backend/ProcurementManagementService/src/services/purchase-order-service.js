const { Op } = require("sequelize");
const {
  PurchaseOrderRepository,
  purchaseOrderLegacyDetailIncludes,
} = require("../repository/purchase-order-repository");
const { ProcurementCaseRepository } = require("../repository/procurement-case-repository");
const {
  asAmountNumber,
  asId,
  buildCursorResponse,
  decoratePurchaseOrder,
  isCursorMode,
  normalizeAmount,
  normalizeCursor,
  normalizeLimit,
  normalizeSortBy,
  normalizeSortDirection,
  normalizeNullableDate,
  normalizeNullableAmount,
  normalizeNullableText,
  normalizeText,
  notFound,
  requireAmount,
  requireDate,
  requireValue,
  roundAmount,
} = require("../utils/procurement-domain");
const PbgEngineService = require("./pbg-engine-service");

const INSTALLATION_TYPES = new Set([
  "normal",
  "site_not_ready",
  "plug_and_play",
  "not_required",
]);
const PURCHASE_ORDER_SORT_FIELDS = [
  "id",
  "po_no",
  "po_date",
  "po_value",
  "po_quantity",
  "status",
  "inspection_status",
  "delivery_status",
  "warranty_start_date",
];

const getExtendedAllocation = (tenderVendor, basis) => {
  const base =
    basis === "amount"
      ? asAmountNumber(tenderVendor?.loa_allocated_amount)
      : asAmountNumber(tenderVendor?.loa_allocated_quantity);
  const extensions = Array.isArray(tenderVendor?.allocation_extensions)
    ? tenderVendor.allocation_extensions
    : [];
  const extensionTotal = extensions.reduce((sum, entry) => {
    if (String(entry?.extension_basis || "") !== basis) return sum;
    return (
      sum +
      (basis === "amount"
        ? asAmountNumber(entry?.extension_amount)
        : asAmountNumber(entry?.extension_quantity))
    );
  }, 0);
  return roundAmount(base + extensionTotal);
};

const getAllocationExtensionTotalsByItem = (tenderVendor, basis) => {
  const extensions = Array.isArray(tenderVendor?.allocation_extensions)
    ? tenderVendor.allocation_extensions
    : [];
  return extensions.reduce((map, entry) => {
    if (String(entry?.extension_basis || "") !== basis) return map;
    const items = Array.isArray(entry?.items) ? entry.items : [];
    items.forEach((item) => {
      const tenderItemId = Number(item?.tender_item_id);
      if (!tenderItemId) return;
      const value =
        basis === "amount"
          ? asAmountNumber(item?.extension_amount)
          : asAmountNumber(item?.extension_quantity);
      if (value <= 0) return;
      map.set(tenderItemId, roundAmount((map.get(tenderItemId) || 0) + value));
    });
    return map;
  }, new Map());
};

const getAllocationExtensionTotal = (tenderVendor, basis) => {
  const extensions = Array.isArray(tenderVendor?.allocation_extensions)
    ? tenderVendor.allocation_extensions
    : [];
  return roundAmount(
    extensions.reduce((sum, entry) => {
      if (String(entry?.extension_basis || "") !== basis) return sum;
      const items = Array.isArray(entry?.items) ? entry.items : [];
      if (items.length) {
        return (
          sum +
          items.reduce(
            (itemSum, item) =>
              itemSum +
              (basis === "amount"
                ? asAmountNumber(item?.extension_amount)
                : asAmountNumber(item?.extension_quantity)),
            0,
          )
        );
      }
      return (
        sum +
        (basis === "amount"
          ? asAmountNumber(entry?.extension_amount)
          : asAmountNumber(entry?.extension_quantity))
      );
    }, 0),
  );
};

const rowsByItemId = (rows = [], field) =>
  rows.reduce((map, row) => {
    const itemId = Number(row?.purchase_order_item_id);
    if (!itemId) return map;
    map.set(itemId, roundAmount((map.get(itemId) || 0) + asAmountNumber(row?.[field])));
    return map;
  }, new Map());

const calculatePoItemValue = (item) =>
  roundAmount(
    asAmountNumber(item?.quantity) * asAmountNumber(item?.unit_rate),
  );

const rowsByItemIdFromInvoices = (invoices = [], field) =>
  rowsByItemId(flattenWorkflowItems(invoices), field);

const flattenWorkflowItems = (batches = [], relation = "items") =>
  (Array.isArray(batches) ? batches : []).flatMap((batch) =>
    Array.isArray(batch?.[relation]) ? batch[relation] : [],
  );

const buildPoLedger = (purchaseOrder) => {
  const items = Array.isArray(purchaseOrder?.items) ? purchaseOrder.items : [];
  const inspections = flattenWorkflowItems(purchaseOrder?.inspections);
  const deliveries = flattenWorkflowItems(purchaseOrder?.delivery_batches);
  const installations = flattenWorkflowItems(purchaseOrder?.installation_batches);
  const sellerInvoiceItems = flattenWorkflowItems(purchaseOrder?.seller_invoices);
  const purchaseBookedItems = (Array.isArray(purchaseOrder?.purchase_invoices)
    ? purchaseOrder.purchase_invoices
    : []
  ).flatMap((invoice) =>
    Array.isArray(invoice?.seller_invoice?.items) ? invoice.seller_invoice.items : [],
  );
  const saleInvoiceItems = flattenWorkflowItems(purchaseOrder?.sale_invoices);
  const offeredByItem = rowsByItemId(inspections, "offered_quantity");
  const acceptedByItem = rowsByItemId(inspections, "accepted_quantity");
  const deliveredByItem = rowsByItemId(deliveries, "delivered_quantity");
  const installedByItem = rowsByItemId(installations, "installed_quantity");
  const sellerInvoicedByItem = rowsByItemId(sellerInvoiceItems, "quantity");
  const purchaseBookedByItem = rowsByItemId(purchaseBookedItems, "quantity");
  const saleInvoicedByItem = rowsByItemId(saleInvoiceItems, "quantity");

  return items.map((item) => {
    const poQuantity = asAmountNumber(item.quantity);
    const offeredQuantity = offeredByItem.get(Number(item.id)) || 0;
    const acceptedQuantity = acceptedByItem.get(Number(item.id)) || 0;
    const deliveredQuantity = deliveredByItem.get(Number(item.id)) || 0;
    const installedQuantity = installedByItem.get(Number(item.id)) || 0;
    const sellerInvoicedQuantity = sellerInvoicedByItem.get(Number(item.id)) || 0;
    const purchaseBookedQuantity = purchaseBookedByItem.get(Number(item.id)) || 0;
    const saleInvoicedQuantity = saleInvoicedByItem.get(Number(item.id)) || 0;
    const sellerEligibleQuantity =
      item.installation_required === false
        ? deliveredQuantity
        : installedQuantity;
    return {
      purchase_order_item_id: item.id,
      item_name: item.item_name,
      item_description: item.item_description,
      make: item.make,
      model: item.model,
      po_quantity: poQuantity,
      offered_quantity: offeredQuantity,
      accepted_quantity: acceptedQuantity,
      delivered_quantity: deliveredQuantity,
      installed_quantity: installedQuantity,
      seller_invoiced_quantity: sellerInvoicedQuantity,
      purchase_booked_quantity: purchaseBookedQuantity,
      sale_invoiced_quantity: saleInvoicedQuantity,
      remaining_for_inspection: roundAmount(Math.max(poQuantity - offeredQuantity, 0)),
      remaining_for_acceptance: roundAmount(Math.max(offeredQuantity - acceptedQuantity, 0)),
      remaining_for_delivery: roundAmount(Math.max(acceptedQuantity - deliveredQuantity, 0)),
      remaining_for_installation: roundAmount(Math.max(deliveredQuantity - installedQuantity, 0)),
      remaining_for_seller_invoice: roundAmount(Math.max(sellerEligibleQuantity - sellerInvoicedQuantity, 0)),
      remaining_for_sale_invoice: roundAmount(Math.max(sellerInvoicedQuantity - saleInvoicedQuantity, 0)),
    };
  });
};

const validateRowsAgainstPoItems = (purchaseOrder, items = [], quantityField, balanceField, label) => {
  const ledgerByItem = new Map(buildPoLedger(purchaseOrder).map((row) => [Number(row.purchase_order_item_id), row]));
  const requestedByItem = new Map();
  return items.map((item) => {
    const itemId = asId(item.purchase_order_item_id, "PO item id");
    const ledger = ledgerByItem.get(itemId);
    if (!ledger) {
      const error = new Error(`${label} item is not part of this PO.`);
      error.statusCode = 409;
      throw error;
    }
    const quantity = asAmountNumber(requireAmount(item, quantityField, `${label} quantity`));
    requestedByItem.set(itemId, roundAmount((requestedByItem.get(itemId) || 0) + quantity));
    if (requestedByItem.get(itemId) > asAmountNumber(ledger[balanceField])) {
      const error = new Error(`${label} quantity exceeds allowed balance for ${ledger.item_name}.`);
      error.statusCode = 409;
      throw error;
    }
    return { itemId, quantity, ledger };
  });
};

const decoratePurchaseOrderWithLedger = (purchaseOrder) => {
  const decorated = decoratePurchaseOrder(purchaseOrder);
  if (decorated?.dataValues) {
    decorated.dataValues.quantity_ledger = buildPoLedger(decorated);
  }
  return decorated;
};

const calculateInvoiceLine = ({ quantity, unitRate, gstPercentage = 0 }) => {
  const qty = asAmountNumber(quantity);
  const rate = asAmountNumber(unitRate);
  const gst = asAmountNumber(gstPercentage);
  const taxableAmount = roundAmount(qty * rate);
  const gstAmount = roundAmount((taxableAmount * gst) / 100);
  return {
    taxableAmount,
    gstAmount,
    totalAmount: roundAmount(taxableAmount + gstAmount),
  };
};

const sumInvoiceLines = (items = []) =>
  items.reduce(
    (summary, item) => ({
      taxableAmount: roundAmount(summary.taxableAmount + asAmountNumber(item.taxable_amount)),
      gstAmount: roundAmount(summary.gstAmount + asAmountNumber(item.gst_amount)),
      totalAmount: roundAmount(summary.totalAmount + asAmountNumber(item.total_amount)),
    }),
    { taxableAmount: 0, gstAmount: 0, totalAmount: 0 },
  );

class PurchaseOrderService {
  constructor() {
    this.repository = new PurchaseOrderRepository();
    this.procurementCaseRepository = new ProcurementCaseRepository();
    this.pbgEngineService = new PbgEngineService();
  }

  async list(query = {}) {
    const where = {};
    if (query.tender_id) where.tender_id = asId(query.tender_id, "Tender id");
    if (query.firm_id) where.firm_id = asId(query.firm_id, "Firm id");
    const search = normalizeText(query.search);
    if (search) {
      where[Op.or] = [
        { po_no: { [Op.like]: `%${search}%` } },
        { status: { [Op.like]: `%${search}%` } },
        { "$firm.firm_name$": { [Op.like]: `%${search}%` } },
        { "$firm.firm_code$": { [Op.like]: `%${search}%` } },
        { "$tender.tender_reference_no$": { [Op.like]: `%${search}%` } },
        { "$tender.tender_title$": { [Op.like]: `%${search}%` } },
      ];
    }

    const sortBy = normalizeSortBy(query.sortBy || query.sort_by, PURCHASE_ORDER_SORT_FIELDS, "id");
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
    let purchaseOrder;
    try {
      purchaseOrder = await this.repository.findByPk(asId(id, "PO id"));
    } catch (error) {
      const message = String(error?.message || "").toLowerCase();
      const isPaymentTableGap =
        message.includes("purchase_order_payments") ||
        message.includes("vendor_payments");

      if (!isPaymentTableGap) throw error;

      purchaseOrder = await this.repository.findByPk(
        asId(id, "PO id"),
        purchaseOrderLegacyDetailIncludes,
      );
    }
    if (!purchaseOrder) throw notFound("Purchase order not found.");
    return decoratePurchaseOrderWithLedger(purchaseOrder);
  }

  async create(payload = {}) {
    const firm_id = asId(payload.firm_id, "Firm id");
    const tender_id = payload.tender_id ? asId(payload.tender_id, "Tender id") : null;

    const firm = await this.repository.findFirmByPk(firm_id);
    if (!firm) {
      const error = new Error("Firm not found.");
      error.statusCode = 404;
      throw error;
    }

    let tender = null;
    let tenderVendor = null;
    if (tender_id) {
      tender = await this.repository.findTenderByPk(tender_id);
      if (!tender) {
        const error = new Error("Tender not found.");
        error.statusCode = 404;
        throw error;
      }

      tenderVendor = await this.repository.findTenderVendorByTenderAndFirm(tender_id, firm_id);
      if (!tenderVendor) {
        const error = new Error("Selected firm is not linked with this tender.");
        error.statusCode = 409;
        throw error;
      }

      if (String(tenderVendor.commercial_status || "").toLowerCase() !== "qualified") {
        const error = new Error("PO can be created only for commercially qualified tender vendors.");
        error.statusCode = 409;
        throw error;
      }

      const allocationBasis = String(
        tenderVendor.loa_allocation_basis || "",
      ).toLowerCase();
      if (allocationBasis === "amount") {
        const existingPurchaseOrders =
          await this.repository.findPurchaseOrdersByTenderAndFirm(tender_id, firm_id);
        const existingUsed = existingPurchaseOrders.reduce(
          (sum, purchaseOrder) =>
            sum +
            asAmountNumber(purchaseOrder.po_value),
          0,
        );
        const requestedUse = asAmountNumber(payload.po_value);
        const availableAllocation = getExtendedAllocation(tenderVendor, allocationBasis);
        if (availableAllocation <= 0) {
          const error = new Error(
            `No ${allocationBasis} allocation is available for this vendor. Save allocation or extension first.`,
          );
          error.statusCode = 409;
          throw error;
        }
        if (roundAmount(existingUsed + requestedUse) > availableAllocation) {
          const error = new Error(
            `PO exceeds allocated ${allocationBasis}. Record allocation extension before adding this PO.`,
          );
          error.statusCode = 409;
          throw error;
        }
      }
    }

    const requiredPbgPercentage = normalizeNullableAmount(payload.required_pbg_percentage);
    const requiredPbgAmount =
      payload.required_pbg_amount === undefined || payload.required_pbg_amount === null || payload.required_pbg_amount === ""
        ? null
        : requireAmount(payload, "required_pbg_amount", "Required PBG amount");

    const resolvedRequiredPbgAmount =
      requiredPbgAmount ||
      (requiredPbgPercentage
        ? normalizeAmount((asAmountNumber(payload.po_value) * asAmountNumber(requiredPbgPercentage)) / 100)
        : null);
    const submittedItems = Array.isArray(payload.items) ? payload.items : [];
    const tenderItems = Array.isArray(tender?.items) ? tender.items : [];
    const normalizedItems = submittedItems
      .filter((item) => asAmountNumber(item?.quantity) > 0)
      .map((item) => {
        const tenderItem = item.tender_item_id
          ? tenderItems.find((row) => Number(row.id) === Number(item.tender_item_id))
          : null;
        const indentItem = tenderItem?.indent_item || null;
        return {
          tender_item_id: tenderItem?.id || (item.tender_item_id ? asId(item.tender_item_id, "Tender item id") : null),
          indent_item_id:
            tenderItem?.indent_item_id ||
            (item.indent_item_id ? asId(item.indent_item_id, "Indent item id") : null),
          item_name:
            normalizeText(item.item_name) ||
            indentItem?.item_name ||
            `PO Item ${item.tender_item_id || ""}`.trim(),
          item_description:
            normalizeNullableText(item.item_description) ||
            normalizeNullableText(indentItem?.specification),
          make: normalizeNullableText(item.make),
          model: normalizeNullableText(item.model),
          quantity: requireAmount(item, "quantity", "PO item quantity"),
          unit: normalizeNullableText(item.unit) || normalizeNullableText(tenderItem?.unit || indentItem?.unit),
          unit_rate:
            item.unit_rate === undefined || item.unit_rate === null || item.unit_rate === ""
              ? null
              : requireAmount(item, "unit_rate", "Unit rate"),
          gst_percentage: normalizeNullableAmount(item.gst_percentage),
          installation_required:
            item.installation_required === false ||
            String(item.installation_required) === "false"
              ? false
              : true,
          installation_mode:
            item.installation_required === false ||
            String(item.installation_required) === "false"
              ? "not_required"
              : "normal",
          remarks: normalizeNullableText(item.remarks),
        };
      });

    if (
      tender &&
      String(tenderVendor?.loa_allocation_basis || "").toLowerCase() === "quantity"
    ) {
      const quoteRows = Array.isArray(tenderVendor?.commercial_item_quotes)
        ? tenderVendor.commercial_item_quotes
        : [];
      const baseAllocationByItem = new Map(
        quoteRows.map((quote) => [
          Number(quote.tender_item_id),
          asAmountNumber(quote.loa_allocated_quantity),
        ]),
      );
      const existingPurchaseOrders =
        await this.repository.findPurchaseOrdersByTenderAndFirm(tender_id, firm_id);
      const existingUsedByItem = new Map();
      const requestedByItem = new Map();
      const extensionByItem = getAllocationExtensionTotalsByItem(
        tenderVendor,
        "quantity",
      );

      existingPurchaseOrders.forEach((purchaseOrder) => {
        (Array.isArray(purchaseOrder?.items) ? purchaseOrder.items : []).forEach(
          (item) => {
            const tenderItemId = Number(item?.tender_item_id);
            if (!tenderItemId) return;
            existingUsedByItem.set(
              tenderItemId,
              roundAmount(
                (existingUsedByItem.get(tenderItemId) || 0) +
                  asAmountNumber(item?.quantity),
              ),
            );
          },
        );
      });

      normalizedItems.forEach((item) => {
        const tenderItemId = Number(item.tender_item_id || 0);
        if (!tenderItemId) return;
        requestedByItem.set(
          tenderItemId,
          roundAmount(
            (requestedByItem.get(tenderItemId) || 0) + asAmountNumber(item.quantity),
          ),
        );
      });

      for (const tenderItem of tenderItems) {
        const tenderItemId = Number(tenderItem.id);
        const baseAllocated = asAmountNumber(baseAllocationByItem.get(tenderItemId));
        const extensionAllocated = asAmountNumber(extensionByItem.get(tenderItemId));
        const existingUsed = asAmountNumber(existingUsedByItem.get(tenderItemId));
        const requested = asAmountNumber(requestedByItem.get(tenderItemId));
        const allowed = roundAmount(baseAllocated + extensionAllocated);
        if (roundAmount(existingUsed + requested) > allowed) {
          const matchingItem = tenderItems.find(
            (item) => Number(item.id) === tenderItemId,
          );
          const error = new Error(
            `${
              matchingItem?.indent_item?.item_name || "PO item quantity"
            } exceeds this vendor's allocated item-wise quantity. Record item-wise quantity extension before adding this PO.`,
          );
          error.statusCode = 409;
          throw error;
        }
      }
    }

    if (
      tender &&
      String(tenderVendor?.loa_allocation_basis || "").toLowerCase() === "amount"
    ) {
      const quoteRows = Array.isArray(tenderVendor?.commercial_item_quotes)
        ? tenderVendor.commercial_item_quotes
        : [];
      const baseAllocationByItem = new Map(
        quoteRows.map((quote) => [
          Number(quote.tender_item_id),
          asAmountNumber(quote.loa_allocated_amount),
        ]),
      );
      const extensionByItem = getAllocationExtensionTotalsByItem(
        tenderVendor,
        "amount",
      );
      const existingPurchaseOrders =
        await this.repository.findPurchaseOrdersByTenderAndFirm(tender_id, firm_id);
      const existingUsedByItem = new Map();
      const requestedByItem = new Map();

      existingPurchaseOrders.forEach((purchaseOrder) => {
        (Array.isArray(purchaseOrder?.items) ? purchaseOrder.items : []).forEach(
          (item) => {
            const tenderItemId = Number(item?.tender_item_id);
            if (!tenderItemId) return;
            existingUsedByItem.set(
              tenderItemId,
              roundAmount(
                (existingUsedByItem.get(tenderItemId) || 0) +
                  calculatePoItemValue(item),
              ),
            );
          },
        );
      });

      normalizedItems.forEach((item) => {
        const tenderItemId = Number(item.tender_item_id || 0);
        if (!tenderItemId) return;
        requestedByItem.set(
          tenderItemId,
          roundAmount(
            (requestedByItem.get(tenderItemId) || 0) + calculatePoItemValue(item),
          ),
        );
      });

      for (const tenderItem of tenderItems) {
        const tenderItemId = Number(tenderItem.id);
        const baseAllocated = asAmountNumber(baseAllocationByItem.get(tenderItemId));
        const extensionAllocated = asAmountNumber(extensionByItem.get(tenderItemId));
        const existingUsed = asAmountNumber(existingUsedByItem.get(tenderItemId));
        const requested = asAmountNumber(requestedByItem.get(tenderItemId));
        const allowed = roundAmount(baseAllocated + extensionAllocated);
        if (roundAmount(existingUsed + requested) > allowed) {
          const error = new Error(
            `${
              tenderItem?.indent_item?.item_name || "PO item value"
            } exceeds this vendor's allocated item-wise amount. Record item-wise amount extension before adding this PO.`,
          );
          error.statusCode = 409;
          throw error;
        }
      }
    }

    return this.repository.withTransaction(async (transaction) => {
      const purchaseOrder = await this.repository.create(
        {
          tender_id,
          firm_id,
          po_no: requireValue(payload, "po_no", "PO number"),
          po_date: requireDate(payload, "po_date", "PO date"),
          po_value: requireAmount(payload, "po_value", "PO value"),
          po_quantity:
            payload.po_quantity === undefined || payload.po_quantity === null || payload.po_quantity === ""
              ? null
              : requireAmount(payload, "po_quantity", "PO quantity"),
          po_document_path: normalizeNullableText(payload.po_document_path),
          warranty_period: normalizeNullableText(payload.warranty_period),
          warranty_start_date: normalizeNullableText(payload.warranty_start_date)
            ? requireDate(payload, "warranty_start_date", "Warranty start date")
            : null,
          required_pbg_amount: resolvedRequiredPbgAmount,
          required_pbg_percentage: requiredPbgPercentage,
          status: normalizeText(payload.status) || "released",
          inspection_required: payload.inspection_required !== false,
          inspection_status: normalizeText(payload.inspection_status) || "pending",
          delivery_status: normalizeText(payload.delivery_status) || "pending",
      bill_submission_status: normalizeText(payload.bill_submission_status) || "pending",
          remarks: normalizeNullableText(payload.remarks),
        },
        { transaction },
      );

      if (normalizedItems.length) {
        await this.repository.bulkCreateItems(
          normalizedItems.map((item) => ({
            ...item,
            purchase_order_id: purchaseOrder.id,
          })),
          { transaction },
        );
      }

      if (Number(tender?.procurement_case_id)) {
        await this.procurementCaseRepository.updateProcurementCaseStatusIfAllowed(
          tender.procurement_case_id,
          "po_created",
          ["open", "tender_created", "under_process"],
          { transaction },
        );
      }

      if (tender_id) {
        await this.pbgEngineService.syncTenderObligations(tender_id, {
          transaction,
        });
      }
      return purchaseOrder;
    });
  }

  async update(id, payload = {}) {
    const purchaseOrder = await this.repository.findByPk(asId(id, "PO id"), []);
    if (!purchaseOrder) throw notFound("Purchase order not found.");

    const update = {};
    if ("warranty_start_date" in payload) {
      update.warranty_start_date = normalizeNullableText(payload.warranty_start_date)
        ? requireDate(payload, "warranty_start_date", "Warranty start date")
        : null;
    }
    if ("po_quantity" in payload) {
      update.po_quantity =
        payload.po_quantity === undefined || payload.po_quantity === null || payload.po_quantity === ""
          ? null
          : requireAmount(payload, "po_quantity", "PO quantity");
    }

    await this.repository.update(purchaseOrder, update);
    if (purchaseOrder?.tender_id) {
      await this.pbgEngineService.syncTenderObligations(purchaseOrder.tender_id);
    }
    return this.getById(id);
  }

  async createConsignee(poId, payload = {}) {
    const purchaseOrder = await this.repository.findByPk(asId(poId, "PO id"));
    if (!purchaseOrder) throw notFound("Purchase order not found.");
    const existingDuplicate = (purchaseOrder.consignees || []).find(
      (entry) =>
        String(entry.consignee_name || "").trim().toLowerCase() ===
          String(payload.consignee_name || "").trim().toLowerCase() &&
        String(entry.consignee_address || "").trim().toLowerCase() ===
          String(payload.consignee_address || "").trim().toLowerCase(),
    );
    if (existingDuplicate) {
      const error = new Error("Duplicate consignee name and address already exists for this PO.");
      error.statusCode = 409;
      throw error;
    }
    const allocationItems = (Array.isArray(payload.items) ? payload.items : []).filter(
      (item) => asAmountNumber(item?.allocated_quantity) > 0,
    );
    validateRowsAgainstPoItems(
      purchaseOrder,
      allocationItems,
      "allocated_quantity",
      "po_quantity",
      "Consignee allocation",
    );
    const existingAllocated = flattenWorkflowItems(purchaseOrder.consignees || [], "allocated_items");
    const existingByItem = rowsByItemId(existingAllocated, "allocated_quantity");
    for (const item of allocationItems) {
      const itemId = asId(item.purchase_order_item_id, "PO item id");
      const poItem = (purchaseOrder.items || []).find((row) => Number(row.id) === itemId);
      if (roundAmount((existingByItem.get(itemId) || 0) + asAmountNumber(item.allocated_quantity)) > asAmountNumber(poItem?.quantity)) {
        const error = new Error(`Consignee allocation exceeds PO quantity for ${poItem?.item_name || "item"}.`);
        error.statusCode = 409;
        throw error;
      }
    }

    await this.repository.withTransaction(async (transaction) => {
      const consignee = await this.repository.createConsignee(
        {
          purchase_order_id: purchaseOrder.id,
          consignee_name: requireValue(payload, "consignee_name", "Consignee name"),
          consignee_address: requireValue(payload, "consignee_address", "Consignee address"),
          contact_no: normalizeNullableText(payload.contact_no),
          remarks: normalizeNullableText(payload.remarks),
        },
        { transaction },
      );
      if (allocationItems.length) {
        await this.repository.bulkCreateConsigneeItems(
          allocationItems.map((item) => ({
            consignee_id: consignee.id,
            purchase_order_item_id: asId(item.purchase_order_item_id, "PO item id"),
            allocated_quantity: requireAmount(item, "allocated_quantity", "Allocated quantity"),
            remarks: normalizeNullableText(item.remarks),
          })),
          { transaction },
        );
      }
    });
    return this.getById(poId);
  }

  async createInspection(poId, payload = {}) {
    const purchaseOrder = await this.repository.findByPk(asId(poId, "PO id"));
    if (!purchaseOrder) throw notFound("Purchase order not found.");
    const ledgerByItem = new Map(buildPoLedger(purchaseOrder).map((row) => [Number(row.purchase_order_item_id), row]));
    const items = (Array.isArray(payload.items) ? payload.items : []).filter(
      (item) => asAmountNumber(item?.offered_quantity) > 0 || asAmountNumber(item?.accepted_quantity) > 0,
    );
    if (!items.length) {
      const error = new Error("At least one inspection item is required.");
      error.statusCode = 400;
      throw error;
    }

    const normalizedItems = items.map((item) => {
      const itemId = asId(item.purchase_order_item_id, "PO item id");
      const ledger = ledgerByItem.get(itemId);
      if (!ledger) {
        const error = new Error("Inspection item is not part of this PO.");
        error.statusCode = 409;
        throw error;
      }
      const offered = asAmountNumber(requireAmount(item, "offered_quantity", "Offered quantity"));
      const accepted = asAmountNumber(requireAmount(item, "accepted_quantity", "Accepted quantity"));
      if (accepted > offered) {
        const error = new Error("Accepted quantity cannot exceed offered quantity.");
        error.statusCode = 409;
        throw error;
      }
      if (offered > asAmountNumber(ledger.remaining_for_inspection)) {
        const error = new Error(`Offered quantity exceeds remaining PO quantity for ${ledger.item_name}.`);
        error.statusCode = 409;
        throw error;
      }
      return {
        purchase_order_item_id: itemId,
        offered_quantity: normalizeAmount(offered),
        accepted_quantity: normalizeAmount(accepted),
        remarks: normalizeNullableText(item.remarks),
      };
    });

    await this.repository.withTransaction(async (transaction) => {
      const inspection = await this.repository.createInspection(
        {
          purchase_order_id: purchaseOrder.id,
          inspection_date: requireDate(payload, "inspection_date", "Inspection date"),
          inspection_note_path: normalizeNullableText(payload.inspection_note_path),
          remarks: normalizeNullableText(payload.remarks),
        },
        { transaction },
      );
      await this.repository.bulkCreateInspectionItems(
        normalizedItems.map((item) => ({ ...item, inspection_id: inspection.id })),
        { transaction },
      );
    });
    return this.getById(poId);
  }

  async createDelivery(poId, payload = {}) {
    const purchaseOrder = await this.repository.findByPk(asId(poId, "PO id"));
    if (!purchaseOrder) throw notFound("Purchase order not found.");
    const ledgerByItem = new Map(buildPoLedger(purchaseOrder).map((row) => [Number(row.purchase_order_item_id), row]));
    const consigneeIds = new Set((purchaseOrder.consignees || []).map((entry) => Number(entry.id)));
    const items = (Array.isArray(payload.items) ? payload.items : []).filter(
      (item) => asAmountNumber(item?.delivered_quantity) > 0,
    );
    if (!items.length) {
      const error = new Error("At least one delivery item is required.");
      error.statusCode = 400;
      throw error;
    }

    const requestedByItem = new Map();
    const normalizedItems = items.map((item) => {
      const itemId = asId(item.purchase_order_item_id, "PO item id");
      const consigneeId = asId(item.consignee_id, "Consignee id");
      const ledger = ledgerByItem.get(itemId);
      if (!ledger || !consigneeIds.has(consigneeId)) {
        const error = new Error("Delivery item or consignee is not part of this PO.");
        error.statusCode = 409;
        throw error;
      }
      const delivered = asAmountNumber(requireAmount(item, "delivered_quantity", "Delivered quantity"));
      requestedByItem.set(itemId, roundAmount((requestedByItem.get(itemId) || 0) + delivered));
      if (requestedByItem.get(itemId) > asAmountNumber(ledger.remaining_for_delivery)) {
        const error = new Error(`Delivered quantity exceeds accepted inspection quantity for ${ledger.item_name}.`);
        error.statusCode = 409;
        throw error;
      }
      return {
        purchase_order_item_id: itemId,
        consignee_id: consigneeId,
        delivered_quantity: normalizeAmount(delivered),
        remarks: normalizeNullableText(item.remarks),
      };
    });

    await this.repository.withTransaction(async (transaction) => {
      const batch = await this.repository.createDeliveryBatch(
        {
          purchase_order_id: purchaseOrder.id,
          delivery_challan_no: normalizeNullableText(payload.delivery_challan_no),
          delivery_challan_date: normalizeNullableDate(payload.delivery_challan_date),
          seller_invoice_no: normalizeNullableText(payload.seller_invoice_no),
          seller_invoice_date: normalizeNullableDate(payload.seller_invoice_date),
          delivery_document_path: normalizeNullableText(payload.delivery_document_path),
          invoice_document_path: normalizeNullableText(payload.invoice_document_path),
          remarks: normalizeNullableText(payload.remarks),
        },
        { transaction },
      );
      await this.repository.bulkCreateDeliveryItems(
        normalizedItems.map((item) => ({ ...item, delivery_batch_id: batch.id })),
        { transaction },
      );
    });
    return this.getById(poId);
  }

  async createInstallation(poId, payload = {}) {
    const purchaseOrder = await this.repository.findByPk(asId(poId, "PO id"));
    if (!purchaseOrder) throw notFound("Purchase order not found.");
    const installationType = normalizeText(payload.installation_type) || "normal";
    if (!INSTALLATION_TYPES.has(installationType)) {
      const error = new Error("Installation type is invalid.");
      error.statusCode = 400;
      throw error;
    }
    const ledgerByItem = new Map(buildPoLedger(purchaseOrder).map((row) => [Number(row.purchase_order_item_id), row]));
    const consigneeIds = new Set((purchaseOrder.consignees || []).map((entry) => Number(entry.id)));
    const items = (Array.isArray(payload.items) ? payload.items : []).filter(
      (item) => asAmountNumber(item?.installed_quantity) > 0,
    );
    if (!items.length) {
      const error = new Error("At least one installation item is required.");
      error.statusCode = 400;
      throw error;
    }

    const requestedByItem = new Map();
    const normalizedItems = items.map((item) => {
      const itemId = asId(item.purchase_order_item_id, "PO item id");
      const consigneeId = asId(item.consignee_id, "Consignee id");
      const ledger = ledgerByItem.get(itemId);
      if (!ledger || !consigneeIds.has(consigneeId)) {
        const error = new Error("Installation item or consignee is not part of this PO.");
        error.statusCode = 409;
        throw error;
      }
      const installed = asAmountNumber(requireAmount(item, "installed_quantity", "Installed quantity"));
      requestedByItem.set(itemId, roundAmount((requestedByItem.get(itemId) || 0) + installed));
      if (requestedByItem.get(itemId) > asAmountNumber(ledger.remaining_for_installation)) {
        const error = new Error(`Installed quantity exceeds delivered quantity for ${ledger.item_name}.`);
        error.statusCode = 409;
        throw error;
      }
      return {
        purchase_order_item_id: itemId,
        consignee_id: consigneeId,
        installed_quantity: normalizeAmount(installed),
        installation_completion_date: requireDate(item, "installation_completion_date", "Installation completion date"),
        remarks: normalizeNullableText(item.remarks),
      };
    });

    await this.repository.withTransaction(async (transaction) => {
      const batch = await this.repository.createInstallationBatch(
        {
          purchase_order_id: purchaseOrder.id,
          installation_type: installationType,
          report_path: normalizeNullableText(payload.report_path),
          noc_path: normalizeNullableText(payload.noc_path),
          declaration_path: normalizeNullableText(payload.declaration_path),
          remarks: normalizeNullableText(payload.remarks),
        },
        { transaction },
      );
      await this.repository.bulkCreateInstallationItems(
        normalizedItems.map((item) => ({ ...item, installation_batch_id: batch.id })),
        { transaction },
      );
    });
    return this.getById(poId);
  }

  async createSellerInvoice(poId, payload = {}) {
    const purchaseOrder = await this.repository.findByPk(asId(poId, "PO id"));
    if (!purchaseOrder) throw notFound("Purchase order not found.");
    const ledgerByItem = new Map(buildPoLedger(purchaseOrder).map((row) => [Number(row.purchase_order_item_id), row]));
    const consigneeIds = new Set((purchaseOrder.consignees || []).map((entry) => Number(entry.id)));
    const poItemsById = new Map((purchaseOrder.items || []).map((item) => [Number(item.id), item]));
    const items = (Array.isArray(payload.items) ? payload.items : []).filter(
      (item) => asAmountNumber(item?.quantity) > 0,
    );
    if (!items.length) {
      const error = new Error("At least one seller invoice item is required.");
      error.statusCode = 400;
      throw error;
    }

    const requestedByItem = new Map();
    const normalizedItems = items.map((item) => {
      const itemId = asId(item.purchase_order_item_id, "PO item id");
      const consigneeId = item.consignee_id ? asId(item.consignee_id, "Consignee id") : null;
      const ledger = ledgerByItem.get(itemId);
      const poItem = poItemsById.get(itemId);
      if (!ledger || (consigneeId && !consigneeIds.has(consigneeId))) {
        const error = new Error("Seller invoice item or consignee is not part of this PO.");
        error.statusCode = 409;
        throw error;
      }
      const quantity = asAmountNumber(requireAmount(item, "quantity", "Invoice quantity"));
      requestedByItem.set(itemId, roundAmount((requestedByItem.get(itemId) || 0) + quantity));
      if (requestedByItem.get(itemId) > asAmountNumber(ledger.remaining_for_seller_invoice)) {
        const error = new Error(`Seller invoice quantity exceeds eligible quantity for ${ledger.item_name}.`);
        error.statusCode = 409;
        throw error;
      }
      const unitRate =
        item.unit_rate === undefined || item.unit_rate === null || item.unit_rate === ""
          ? asAmountNumber(poItem?.unit_rate)
          : asAmountNumber(requireAmount(item, "unit_rate", "Unit rate"));
      const gstPercentage =
        item.gst_percentage === undefined || item.gst_percentage === null || item.gst_percentage === ""
          ? asAmountNumber(poItem?.gst_percentage)
          : asAmountNumber(normalizeAmount(item.gst_percentage));
      const amounts = calculateInvoiceLine({ quantity, unitRate, gstPercentage });
      return {
        purchase_order_item_id: itemId,
        consignee_id: consigneeId,
        quantity: normalizeAmount(quantity),
        unit_rate: normalizeAmount(unitRate),
        gst_percentage: normalizeAmount(gstPercentage),
        taxable_amount: normalizeAmount(amounts.taxableAmount),
        gst_amount: normalizeAmount(amounts.gstAmount),
        total_amount: normalizeAmount(amounts.totalAmount),
      };
    });
    const summary = sumInvoiceLines(normalizedItems);

    await this.repository.withTransaction(async (transaction) => {
      const sellerInvoice = await this.repository.createSellerInvoice(
        {
          purchase_order_id: purchaseOrder.id,
          firm_id: purchaseOrder.firm_id,
          consignee_id: payload.consignee_id ? asId(payload.consignee_id, "Consignee id") : null,
          seller_invoice_no: requireValue(payload, "seller_invoice_no", "Seller invoice no."),
          seller_invoice_date: requireDate(payload, "seller_invoice_date", "Seller invoice date"),
          bill_from: normalizeNullableText(payload.bill_from) || purchaseOrder?.firm?.firm_name || null,
          ship_to: normalizeNullableText(payload.ship_to),
          invoice_document_path: normalizeNullableText(payload.invoice_document_path),
          taxable_amount: normalizeAmount(summary.taxableAmount),
          gst_amount: normalizeAmount(summary.gstAmount),
          grand_total: normalizeAmount(summary.totalAmount),
          remarks: normalizeNullableText(payload.remarks),
        },
        { transaction },
      );
      await this.repository.bulkCreateSellerInvoiceItems(
        normalizedItems.map((item) => ({ ...item, seller_invoice_id: sellerInvoice.id })),
        { transaction },
      );
    });
    return this.getById(poId);
  }

  async createPurchaseInvoice(poId, payload = {}) {
    const purchaseOrder = await this.repository.findByPk(asId(poId, "PO id"));
    if (!purchaseOrder) throw notFound("Purchase order not found.");
    const sellerInvoiceId = asId(payload.seller_invoice_id, "Seller invoice id");
    const sellerInvoice = (purchaseOrder.seller_invoices || []).find(
      (invoice) => Number(invoice.id) === sellerInvoiceId,
    );
    if (!sellerInvoice) {
      const error = new Error("Seller invoice is not linked with this PO.");
      error.statusCode = 409;
      throw error;
    }
    const grossAmount = asAmountNumber(sellerInvoice.grand_total);
    const tdsAmount = asAmountNumber(normalizeNullableAmount(payload.tds_amount));
    const roundOff = asAmountNumber(normalizeNullableAmount(payload.round_off));
    await this.repository.createPurchaseInvoice({
      purchase_order_id: purchaseOrder.id,
      seller_invoice_id: sellerInvoiceId,
      voucher_no: requireValue(payload, "voucher_no", "Voucher no."),
      voucher_date: requireDate(payload, "voucher_date", "Voucher date"),
      tds_amount: normalizeAmount(tdsAmount),
      round_off: normalizeAmount(roundOff),
      gross_amount: normalizeAmount(grossAmount),
      grand_total: normalizeAmount(grossAmount - tdsAmount + roundOff),
      bill_document_path: normalizeNullableText(payload.bill_document_path),
      remarks: normalizeNullableText(payload.remarks),
    });
    return this.getById(poId);
  }

  async createSaleInvoice(poId, payload = {}) {
    const purchaseOrder = await this.repository.findByPk(asId(poId, "PO id"));
    if (!purchaseOrder) throw notFound("Purchase order not found.");
    const ledgerByItem = new Map(buildPoLedger(purchaseOrder).map((row) => [Number(row.purchase_order_item_id), row]));
    const poItemsById = new Map((purchaseOrder.items || []).map((item) => [Number(item.id), item]));
    const items = (Array.isArray(payload.items) ? payload.items : []).filter(
      (item) => asAmountNumber(item?.quantity) > 0,
    );
    if (!items.length) {
      const error = new Error("At least one sale invoice item is required.");
      error.statusCode = 400;
      throw error;
    }
    const chargeType = normalizeText(payload.consultancy_charge_type) || "percentage";
    const consultancyPercentage = asAmountNumber(normalizeNullableAmount(payload.consultancy_percentage));
    const consultancyFlatAmount = asAmountNumber(normalizeNullableAmount(payload.consultancy_flat_amount));
    const requestedByItem = new Map();
    const normalizedItems = items.map((item) => {
      const itemId = asId(item.purchase_order_item_id, "PO item id");
      const ledger = ledgerByItem.get(itemId);
      const poItem = poItemsById.get(itemId);
      if (!ledger) {
        const error = new Error("Sale invoice item is not part of this PO.");
        error.statusCode = 409;
        throw error;
      }
      const quantity = asAmountNumber(requireAmount(item, "quantity", "Sale invoice quantity"));
      requestedByItem.set(itemId, roundAmount((requestedByItem.get(itemId) || 0) + quantity));
      if (requestedByItem.get(itemId) > asAmountNumber(ledger.remaining_for_sale_invoice)) {
        const error = new Error(`Sale invoice quantity exceeds seller invoiced balance for ${ledger.item_name}.`);
        error.statusCode = 409;
        throw error;
      }
      const baseRate =
        item.base_unit_rate === undefined || item.base_unit_rate === null || item.base_unit_rate === ""
          ? asAmountNumber(poItem?.unit_rate)
          : asAmountNumber(requireAmount(item, "base_unit_rate", "Base unit rate"));
      const perUnitConsultancy =
        chargeType === "flat"
          ? quantity > 0
            ? roundAmount(consultancyFlatAmount / quantity)
            : 0
          : roundAmount((baseRate * consultancyPercentage) / 100);
      const finalRate = roundAmount(baseRate + perUnitConsultancy);
      const gstPercentage =
        item.gst_percentage === undefined || item.gst_percentage === null || item.gst_percentage === ""
          ? asAmountNumber(poItem?.gst_percentage)
          : asAmountNumber(normalizeAmount(item.gst_percentage));
      const amounts = calculateInvoiceLine({ quantity, unitRate: finalRate, gstPercentage });
      return {
        purchase_order_item_id: itemId,
        consignee_id: item.consignee_id ? asId(item.consignee_id, "Consignee id") : null,
        quantity: normalizeAmount(quantity),
        base_unit_rate: normalizeAmount(baseRate),
        consultancy_amount: normalizeAmount(roundAmount(perUnitConsultancy * quantity)),
        final_unit_rate: normalizeAmount(finalRate),
        gst_percentage: normalizeAmount(gstPercentage),
        taxable_amount: normalizeAmount(amounts.taxableAmount),
        gst_amount: normalizeAmount(amounts.gstAmount),
        total_amount: normalizeAmount(amounts.totalAmount),
      };
    });
    const summary = sumInvoiceLines(normalizedItems);
    const roundOff = asAmountNumber(normalizeNullableAmount(payload.round_off));

    await this.repository.withTransaction(async (transaction) => {
      const saleInvoice = await this.repository.createSaleInvoice(
        {
          purchase_order_id: purchaseOrder.id,
          sale_invoice_no: requireValue(payload, "sale_invoice_no", "Sale invoice no."),
          sale_invoice_date: requireDate(payload, "sale_invoice_date", "Sale invoice date"),
          billing_mode: normalizeText(payload.billing_mode) || "consolidated",
          bill_to: requireValue(payload, "bill_to", "Bill to"),
          ship_to: normalizeNullableText(payload.ship_to),
          consultancy_charge_type: chargeType,
          consultancy_percentage: chargeType === "percentage" ? normalizeAmount(consultancyPercentage) : null,
          consultancy_flat_amount: chargeType === "flat" ? normalizeAmount(consultancyFlatAmount) : null,
          taxable_amount: normalizeAmount(summary.taxableAmount),
          gst_amount: normalizeAmount(summary.gstAmount),
          round_off: normalizeAmount(roundOff),
          grand_total: normalizeAmount(summary.totalAmount + roundOff),
          invoice_document_path: normalizeNullableText(payload.invoice_document_path),
          remarks: normalizeNullableText(payload.remarks),
        },
        { transaction },
      );
      await this.repository.bulkCreateSaleInvoiceItems(
        normalizedItems.map((item) => ({ ...item, sale_invoice_id: saleInvoice.id })),
        { transaction },
      );
    });
    return this.getById(poId);
  }

  async createVendorPayment(poId, payload = {}) {
    return this.repository.withTransaction(async (transaction) => {
      const purchaseOrder = await this.repository.findByPk(asId(poId, "PO id"));
      if (!purchaseOrder) throw notFound("Purchase order not found.");

      const paymentAmount = Number(
        requireAmount(payload, "payment_amount", "Payment amount"),
      );
      const currentPaidAmount = Number(
        purchaseOrder?.payment_summary?.total_paid_amount || 0,
      );
      const poValue = Number(purchaseOrder?.po_value || 0);

      if (poValue > 0 && roundAmount(currentPaidAmount + paymentAmount) > roundAmount(poValue)) {
        const error = new Error("Total vendor payments cannot exceed the PO value.");
        error.statusCode = 409;
        throw error;
      }

      const vendorPayment = await this.repository.createVendorPayment(
        {
          po_id: purchaseOrder.id,
          payment_stage: requireValue(payload, "payment_stage", "Payment stage"),
          payment_date: requireDate(payload, "payment_date", "Payment date"),
          payment_amount: requireAmount(payload, "payment_amount", "Payment amount"),
          payment_reference_no: normalizeNullableText(payload.payment_reference_no),
          payment_noting_path: normalizeNullableText(payload.payment_noting_path),
          remarks: normalizeNullableText(payload.remarks),
        },
        { transaction },
      );

      const indent = purchaseOrder?.tender?.procurement_case?.indent;
      if (indent?.department_name) {
        await this.repository.createDepartmentFundEntry(
          {
            department_name: indent.department_name,
            subject:
              normalizeNullableText(payload.payment_stage) ||
              `Vendor payment against PO ${purchaseOrder.po_no}`,
            entry_type: "vendor_payment",
            entry_origin: "system_linked",
            amount: requireAmount(payload, "payment_amount", "Payment amount"),
            entry_date: requireDate(payload, "payment_date", "Payment date"),
            reference_no: normalizeNullableText(payload.payment_reference_no),
            financial_year: null,
            estimate_reference: null,
            estimate_date: null,
            estimate_amount: null,
            indent_id: indent.id,
            tender_id: purchaseOrder?.tender?.id || null,
            po_id: purchaseOrder.id,
            vendor_name: purchaseOrder?.firm?.firm_name || null,
            noting_page_path: null,
            payment_noting_path: normalizeNullableText(payload.payment_noting_path),
            remarks: normalizeNullableText(payload.remarks),
            location_scope:
              indent.location_scope ||
              purchaseOrder?.tender?.procurement_case?.location_scope ||
              "PANCHKULA",
          },
          { transaction },
        );
      }

      return vendorPayment;
    });
  }
}

module.exports = PurchaseOrderService;
