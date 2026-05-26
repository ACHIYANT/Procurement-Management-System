const {
  Tender,
  TenderItem,
  TenderSubmissionExtension,
  TenderVendor,
  TenderEmdEntry,
  PurchaseOrder,
  PurchaseOrderItem,
  PbgEntry,
  PbgObligation,
  PbgReceiptAllocation,
  Firm,
  ProcurementCase,
  ProcurementCaseItem,
  Indent,
  IndentItem,
  ItemCategory,
  ItemSubcategory,
  CommitteeMeeting,
  CommitteeNegotiationEntry,
  TenderVendorAllocationExtension,
  TenderVendorItemQuote,
  sequelize,
} = require("../../models");
const { Op } = require("sequelize");
const { buildCursorWhere, buildSortOrder } = require("../utils/procurement-domain");

const tenderDetailIncludes = [
  {
    model: ProcurementCase,
    as: "procurement_case",
    include: [{ model: Indent, as: "indent" }],
  },
  {
    model: TenderItem,
    as: "items",
    separate: true,
    order: [["id", "ASC"]],
    include: [
      {
        model: IndentItem,
        as: "indent_item",
      },
    ],
  },
  {
    model: TenderSubmissionExtension,
    as: "submission_extensions",
    separate: true,
    order: [["extended_upto_date", "DESC"], ["id", "DESC"]],
  },
  {
    model: TenderVendor,
    as: "vendors",
    separate: true,
    order: [["id", "ASC"]],
    include: [
      { model: Firm, as: "firm" },
      { model: TenderEmdEntry, as: "emd_entry" },
      {
        model: TenderVendorAllocationExtension,
        as: "allocation_extensions",
        separate: true,
        order: [["approval_date", "DESC"], ["id", "DESC"]],
        include: [
          {
            association: "items",
            separate: true,
            order: [["id", "ASC"]],
            include: [
              {
                model: TenderItem,
                as: "tender_item",
                include: [{ model: IndentItem, as: "indent_item" }],
              },
            ],
          },
        ],
      },
      {
        model: TenderVendorItemQuote,
        as: "commercial_item_quotes",
        separate: true,
        order: [["id", "ASC"]],
        include: [
          {
            model: TenderItem,
            as: "tender_item",
            include: [{ model: IndentItem, as: "indent_item" }],
          },
        ],
      },
    ],
  },
  {
    model: TenderEmdEntry,
    as: "emd_entries",
    separate: true,
    order: [["id", "ASC"]],
    include: [
      {
        model: TenderVendor,
        as: "tender_vendor",
        include: [{ model: Firm, as: "firm" }],
      },
    ],
  },
  {
    model: CommitteeMeeting,
    as: "committee_meetings",
    separate: true,
    order: [["meeting_date", "DESC"], ["id", "DESC"]],
  },
  {
    model: PurchaseOrder,
    as: "purchase_orders",
    separate: true,
    order: [["id", "DESC"]],
    include: [
      { model: Firm, as: "firm" },
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
      {
        model: PurchaseOrderItem,
        as: "items",
        separate: true,
        order: [["id", "ASC"]],
      },
    ],
  },
];

class TenderRepository {
  async listBase({ where, limit, cursor, sortBy = "id", sortDirection = "DESC" }) {
    return Tender.findAll({
      where: buildCursorWhere({
        baseWhere: where,
        cursor,
        sortBy,
        sortDirection,
      }),
      order: buildSortOrder(sortBy, sortDirection),
      limit,
    });
  }

  async findByPk(id, include = tenderDetailIncludes) {
    return Tender.findByPk(id, { include });
  }

  async findProcurementCaseByPk(id) {
    return ProcurementCase.findByPk(id, {
      include: [
        { model: Indent, as: "indent" },
        {
          model: ProcurementCaseItem,
          as: "case_items",
          include: [
            {
              model: IndentItem,
              as: "indent_item",
              include: [
                { model: ItemCategory, as: "category" },
                { model: ItemSubcategory, as: "subcategory" },
              ],
            },
            {
              model: TenderItem,
              as: "tender_items",
              include: [{ model: Tender, as: "tender" }],
            },
          ],
        },
      ],
    });
  }

  async create(payload, options = {}) {
    return Tender.create(payload, options);
  }

  async updateTender(tender, payload, options = {}) {
    return tender.update(payload, options);
  }

  async bulkCreateTenderItems(payload, options = {}) {
    return TenderItem.bulkCreate(payload, options);
  }

  async findFirmByPk(id) {
    return Firm.findByPk(id);
  }

  async createSubmissionExtension(payload, options = {}) {
    return TenderSubmissionExtension.create(payload, options);
  }

  async findTenderVendorByTenderAndFirm(tenderId, firmId) {
    return TenderVendor.findOne({ where: { tender_id: tenderId, firm_id: firmId } });
  }

  async findSavedLoaAllocationBasis(tenderId) {
    return TenderVendor.findOne({
      where: {
        tender_id: tenderId,
        loa_allocation_basis: { [Op.ne]: null },
      },
      attributes: ["id", "loa_allocation_basis"],
      order: [["id", "ASC"]],
    });
  }

  async findTenderVendorByPk(vendorId) {
    return TenderVendor.findByPk(vendorId, {
      include: [
        { model: Firm, as: "firm" },
        { model: TenderEmdEntry, as: "emd_entry" },
        {
          model: TenderVendorAllocationExtension,
          as: "allocation_extensions",
          separate: true,
          order: [["approval_date", "DESC"], ["id", "DESC"]],
          include: [
            {
              association: "items",
              separate: true,
              order: [["id", "ASC"]],
              include: [
                {
                  model: TenderItem,
                  as: "tender_item",
                  include: [{ model: IndentItem, as: "indent_item" }],
                },
              ],
            },
          ],
        },
        {
          model: TenderVendorItemQuote,
          as: "commercial_item_quotes",
          separate: true,
          order: [["id", "ASC"]],
          include: [
            {
              model: TenderItem,
              as: "tender_item",
              include: [{ model: IndentItem, as: "indent_item" }],
            },
          ],
        },
      ],
    });
  }

  async updateTenderVendor(vendor, payload, options = {}) {
    return vendor.update(payload, options);
  }

  async deleteTenderVendorItemQuotes(tenderVendorId, options = {}) {
    return TenderVendorItemQuote.destroy({
      where: { tender_vendor_id: tenderVendorId },
      ...options,
    });
  }

  async bulkCreateTenderVendorItemQuotes(payload, options = {}) {
    if (!Array.isArray(payload) || !payload.length) return [];
    return TenderVendorItemQuote.bulkCreate(payload, options);
  }

  async createTenderVendor(payload, options = {}) {
    return TenderVendor.create(payload, options);
  }

  async findTenderEmdByTenderVendorId(tenderVendorId) {
    return TenderEmdEntry.findOne({ where: { tender_vendor_id: tenderVendorId } });
  }

  async findPurchaseOrderByTenderAndFirm(tenderId, firmId) {
    return PurchaseOrder.findOne({ where: { tender_id: tenderId, firm_id: firmId } });
  }

  async countCommitteeNegotiationEntriesByTenderVendor(tenderVendorId) {
    return CommitteeNegotiationEntry.count({ where: { tender_vendor_id: tenderVendorId } });
  }

  async destroyTenderEmdEntry(entry, options = {}) {
    return entry.destroy(options);
  }

  async destroyTenderVendor(vendor, options = {}) {
    return vendor.destroy(options);
  }

  async findTendersWithVendorsAndEmd(tenderIds = []) {
    return TenderVendor.findAll({
      where: { tender_id: tenderIds },
      include: [{ model: TenderEmdEntry, as: "emd_entry" }],
      order: [
        ["tender_id", "ASC"],
        ["id", "ASC"],
      ],
    });
  }

  async findPurchaseOrdersWithPbgByTenderIds(tenderIds = []) {
    return PurchaseOrder.findAll({
      where: { tender_id: tenderIds },
      include: [{ model: PbgEntry, as: "pbg_entries" }],
      order: [
        ["tender_id", "ASC"],
        ["id", "ASC"],
      ],
    });
  }

  async findTenderWithVendorsForEmdGeneration(tenderId) {
    return Tender.findByPk(tenderId, {
      include: [
        {
          model: TenderVendor,
          as: "vendors",
          include: [
            { model: Firm, as: "firm" },
            { model: TenderEmdEntry, as: "emd_entry" },
          ],
        },
      ],
    });
  }

  async createTenderEmdEntry(payload, options = {}) {
    return TenderEmdEntry.create(payload, options);
  }

  async createTenderVendorAllocationExtension(payload, options = {}) {
    return TenderVendorAllocationExtension.create(payload, options);
  }

  async bulkCreateTenderVendorAllocationExtensionItems(payload, options = {}) {
    if (!Array.isArray(payload) || !payload.length) return [];
    return sequelize.models.TenderVendorAllocationExtensionItem.bulkCreate(
      payload,
      options,
    );
  }

  async withTransaction(callback) {
    return sequelize.transaction(callback);
  }
}

module.exports = {
  TenderRepository,
  tenderDetailIncludes,
};
