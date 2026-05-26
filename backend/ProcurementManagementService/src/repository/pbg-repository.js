const {
  PurchaseOrder,
  PbgEntry,
  Firm,
  Tender,
  PbgReceiptAllocation,
  PbgObligation,
} = require("../../models");
const { buildCursorWhere, buildSortOrder } = require("../utils/procurement-domain");

const poIncludes = [
  { model: Tender, as: "tender" },
  { model: Firm, as: "firm" },
];

const pbgIncludes = [
  { model: Tender, as: "tender", required: false },
  {
    model: PurchaseOrder,
    as: "purchase_order",
    include: poIncludes,
  },
  { model: Firm, as: "firm" },
  {
    model: PbgReceiptAllocation,
    as: "receipt_allocations",
    separate: true,
    include: [{ model: PbgObligation, as: "pbg_obligation" }],
  },
];

class PbgRepository {
  async list({ where, limit, include = pbgIncludes, cursor, sortBy = "id", sortDirection = "DESC" }) {
    return PbgEntry.findAll({
      where: buildCursorWhere({ baseWhere: where, cursor, sortBy, sortDirection }),
      include,
      order: buildSortOrder(sortBy, sortDirection),
      limit,
      subQuery: false,
    });
  }

  async findByPk(id, include = pbgIncludes) {
    return PbgEntry.findByPk(id, { include });
  }

  async create(payload) {
    return PbgEntry.create(payload);
  }

  async findPurchaseOrderByIdAndFirm(poId, firmId) {
    return PurchaseOrder.findOne({ where: { id: poId, firm_id: firmId } });
  }

  async findPurchaseOrderByPk(id) {
    return PurchaseOrder.findByPk(id);
  }

  async findTenderByPk(id) {
    return Tender.findByPk(id);
  }
}

module.exports = {
  PbgRepository,
  pbgIncludes,
};
