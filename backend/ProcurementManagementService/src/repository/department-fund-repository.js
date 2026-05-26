const {
  DepartmentFundEntry,
  Indent,
  PurchaseOrder,
  Tender,
} = require("../../models");
const { buildCursorWhere, buildSortOrder } = require("../utils/procurement-domain");

const departmentFundIncludes = [
  { model: Indent, as: "indent" },
  { model: Tender, as: "tender" },
  { model: PurchaseOrder, as: "purchase_order" },
];

class DepartmentFundRepository {
  async list({
    where = {},
    limit = 150,
    cursor,
    sortBy = "entry_date",
    sortDirection = "DESC",
  }) {
    return DepartmentFundEntry.findAll({
      where: buildCursorWhere({ baseWhere: where, cursor, sortBy, sortDirection }),
      include: departmentFundIncludes,
      order: buildSortOrder(sortBy, sortDirection),
      limit,
      subQuery: false,
    });
  }

  async create(payload, options = {}) {
    return DepartmentFundEntry.create(payload, options);
  }

  async findIndentByPk(id) {
    return Indent.findByPk(id);
  }

  async findTenderByPk(id) {
    return Tender.findByPk(id);
  }

  async findPurchaseOrderByPk(id) {
    return PurchaseOrder.findByPk(id);
  }
}

module.exports = {
  DepartmentFundRepository,
  departmentFundIncludes,
};
