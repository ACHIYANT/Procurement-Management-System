const {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderConsignee,
  PurchaseOrderConsigneeItem,
  PurchaseOrderInspection,
  PurchaseOrderInspectionItem,
  PurchaseOrderDeliveryBatch,
  PurchaseOrderDeliveryItem,
  PurchaseOrderInstallationBatch,
  PurchaseOrderInstallationItem,
  SellerInvoice,
  SellerInvoiceItem,
  PurchaseInvoice,
  SaleInvoice,
  SaleInvoiceItem,
  TenderItem,
  IndentItem,
  Tender,
  Firm,
  PbgEntry,
  PbgObligation,
  PbgReceiptAllocation,
  TenderVendor,
  TenderVendorItemQuote,
  PurchaseOrderPayment,
  ProcurementCase,
  Indent,
  DepartmentFundEntry,
  sequelize,
} = require("../../models");
const { buildCursorWhere, buildSortOrder } = require("../utils/procurement-domain");

const poIncludes = [
  { model: Tender, as: "tender" },
  { model: Firm, as: "firm" },
];

const purchaseOrderWorkflowIncludes = [
  {
    model: PurchaseOrderItem,
    as: "items",
    separate: true,
    order: [["id", "ASC"]],
    include: [
      {
        model: TenderItem,
        as: "tender_item",
        required: false,
        include: [{ model: IndentItem, as: "indent_item", required: false }],
      },
      { model: IndentItem, as: "indent_item", required: false },
    ],
  },
  {
    model: PurchaseOrderConsignee,
    as: "consignees",
    separate: true,
    order: [["id", "ASC"]],
    include: [{ model: PurchaseOrderConsigneeItem, as: "allocated_items" }],
  },
  {
    model: PurchaseOrderInspection,
    as: "inspections",
    separate: true,
    order: [["inspection_date", "DESC"], ["id", "DESC"]],
    include: [{ model: PurchaseOrderInspectionItem, as: "items" }],
  },
  {
    model: PurchaseOrderDeliveryBatch,
    as: "delivery_batches",
    separate: true,
    order: [["id", "DESC"]],
    include: [{ model: PurchaseOrderDeliveryItem, as: "items" }],
  },
  {
    model: PurchaseOrderInstallationBatch,
    as: "installation_batches",
    separate: true,
    order: [["id", "DESC"]],
    include: [{ model: PurchaseOrderInstallationItem, as: "items" }],
  },
  {
    model: SellerInvoice,
    as: "seller_invoices",
    separate: true,
    order: [["seller_invoice_date", "DESC"], ["id", "DESC"]],
    include: [
      { model: SellerInvoiceItem, as: "items" },
      { model: PurchaseOrderConsignee, as: "consignee", required: false },
    ],
  },
  {
    model: PurchaseInvoice,
    as: "purchase_invoices",
    separate: true,
    order: [["voucher_date", "DESC"], ["id", "DESC"]],
    include: [
      {
        model: SellerInvoice,
        as: "seller_invoice",
        required: false,
        include: [{ model: SellerInvoiceItem, as: "items" }],
      },
    ],
  },
  {
    model: SaleInvoice,
    as: "sale_invoices",
    separate: true,
    order: [["sale_invoice_date", "DESC"], ["id", "DESC"]],
    include: [{ model: SaleInvoiceItem, as: "items" }],
  },
];

const purchaseOrderDetailIncludes = [
  {
    model: Tender,
    as: "tender",
    include: [
      {
        model: ProcurementCase,
        as: "procurement_case",
        include: [{ model: Indent, as: "indent" }],
      },
    ],
  },
  { model: Firm, as: "firm" },
  ...purchaseOrderWorkflowIncludes,
  {
    model: PurchaseOrderPayment,
    as: "vendor_payments",
    separate: true,
    order: [["payment_date", "DESC"], ["id", "DESC"]],
  },
  { model: PbgEntry, as: "pbg_entries" },
  {
    model: PbgObligation,
    as: "pbg_obligations",
    separate: true,
    order: [["id", "ASC"]],
    include: [
      {
        model: PbgReceiptAllocation,
        as: "receipt_allocations",
        separate: true,
        include: [{ model: PbgEntry, as: "pbg_receipt" }],
      },
    ],
  },
];

const purchaseOrderLegacyDetailIncludes = [
  {
    model: Tender,
    as: "tender",
    include: [
      {
        model: ProcurementCase,
        as: "procurement_case",
        include: [{ model: Indent, as: "indent" }],
      },
    ],
  },
  { model: Firm, as: "firm" },
  ...purchaseOrderWorkflowIncludes,
  { model: PbgEntry, as: "pbg_entries" },
  {
    model: PbgObligation,
    as: "pbg_obligations",
    separate: true,
    order: [["id", "ASC"]],
    include: [
      {
        model: PbgReceiptAllocation,
        as: "receipt_allocations",
        separate: true,
        include: [{ model: PbgEntry, as: "pbg_receipt" }],
      },
    ],
  },
];

class PurchaseOrderRepository {
  async list({ where, limit, include = poIncludes, cursor, sortBy = "id", sortDirection = "DESC" }) {
    return PurchaseOrder.findAll({
      where: buildCursorWhere({ baseWhere: where, cursor, sortBy, sortDirection }),
      include,
      order: buildSortOrder(sortBy, sortDirection),
      limit,
      subQuery: false,
    });
  }

  async findByPk(id, include = purchaseOrderDetailIncludes) {
    return PurchaseOrder.findByPk(id, { include });
  }

  async create(payload, options = {}) {
    return PurchaseOrder.create(payload, options);
  }

  async bulkCreateItems(payload, options = {}) {
    return PurchaseOrderItem.bulkCreate(payload, options);
  }

  async update(purchaseOrder, payload, options = {}) {
    return purchaseOrder.update(payload, options);
  }

  async createVendorPayment(payload, options = {}) {
    return PurchaseOrderPayment.create(payload, options);
  }

  async createConsignee(payload, options = {}) {
    return PurchaseOrderConsignee.create(payload, options);
  }

  async bulkCreateConsigneeItems(payload, options = {}) {
    return PurchaseOrderConsigneeItem.bulkCreate(payload, options);
  }

  async createInspection(payload, options = {}) {
    return PurchaseOrderInspection.create(payload, options);
  }

  async bulkCreateInspectionItems(payload, options = {}) {
    return PurchaseOrderInspectionItem.bulkCreate(payload, options);
  }

  async createDeliveryBatch(payload, options = {}) {
    return PurchaseOrderDeliveryBatch.create(payload, options);
  }

  async bulkCreateDeliveryItems(payload, options = {}) {
    return PurchaseOrderDeliveryItem.bulkCreate(payload, options);
  }

  async createInstallationBatch(payload, options = {}) {
    return PurchaseOrderInstallationBatch.create(payload, options);
  }

  async bulkCreateInstallationItems(payload, options = {}) {
    return PurchaseOrderInstallationItem.bulkCreate(payload, options);
  }

  async createSellerInvoice(payload, options = {}) {
    return SellerInvoice.create(payload, options);
  }

  async bulkCreateSellerInvoiceItems(payload, options = {}) {
    return SellerInvoiceItem.bulkCreate(payload, options);
  }

  async createPurchaseInvoice(payload, options = {}) {
    return PurchaseInvoice.create(payload, options);
  }

  async createSaleInvoice(payload, options = {}) {
    return SaleInvoice.create(payload, options);
  }

  async bulkCreateSaleInvoiceItems(payload, options = {}) {
    return SaleInvoiceItem.bulkCreate(payload, options);
  }

  async createDepartmentFundEntry(payload, options = {}) {
    return DepartmentFundEntry.create(payload, options);
  }

  async withTransaction(callback) {
    return sequelize.transaction(callback);
  }

  async findFirmByPk(id) {
    return Firm.findByPk(id);
  }

  async findTenderByPk(id) {
    return Tender.findByPk(id, {
      include: [
        {
          model: TenderItem,
          as: "items",
          include: [{ model: IndentItem, as: "indent_item" }],
        },
      ],
    });
  }

  async findTenderVendorByTenderAndFirm(tenderId, firmId) {
    return TenderVendor.findOne({
      where: { tender_id: tenderId, firm_id: firmId },
      include: [
        {
          association: "allocation_extensions",
          include: [
            {
              association: "items",
            },
          ],
        },
        {
          model: TenderVendorItemQuote,
          as: "commercial_item_quotes",
        },
      ],
    });
  }

  async findPurchaseOrdersByTenderAndFirm(tenderId, firmId) {
    return PurchaseOrder.findAll({ where: { tender_id: tenderId, firm_id: firmId } });
  }
}

module.exports = {
  PurchaseOrderRepository,
  poIncludes,
  purchaseOrderDetailIncludes,
  purchaseOrderLegacyDetailIncludes,
  purchaseOrderWorkflowIncludes,
};
