const { Tender, TenderVendor, TenderEmdEntry, Firm, PurchaseOrder } = require("../../models");
const { buildCursorWhere, buildSortOrder } = require("../utils/procurement-domain");

const emdIncludes = [
  {
    model: Tender,
    as: "tender",
    include: [{ model: PurchaseOrder, as: "purchase_orders" }],
  },
  {
    model: TenderVendor,
    as: "tender_vendor",
    include: [{ model: Firm, as: "firm" }],
  },
];

class EmdRepository {
  async list({ where, limit, include = emdIncludes, cursor, sortBy = "id", sortDirection = "DESC" }) {
    return TenderEmdEntry.findAll({
      where: buildCursorWhere({ baseWhere: where, cursor, sortBy, sortDirection }),
      include,
      order: buildSortOrder(sortBy, sortDirection),
      limit,
      subQuery: false,
    });
  }

  async findByPk(id, include = emdIncludes) {
    return TenderEmdEntry.findByPk(id, { include });
  }

  async create(payload) {
    return TenderEmdEntry.create(payload);
  }

  async findTenderVendorByIdAndTender(tenderVendorId, tenderId) {
    return TenderVendor.findOne({ where: { id: tenderVendorId, tender_id: tenderId } });
  }
}

module.exports = {
  EmdRepository,
  emdIncludes,
};
