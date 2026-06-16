"use strict";

const { buildCursorWhere, buildSortOrder } = require("../utils/procurement-domain");
const {
  ProcurementCase,
  ProcurementCaseItem,
  Indent,
  IndentItem,
  ItemCategory,
  ItemSubcategory,
  ProcurementEmployee,
  Tender,
  TenderItem,
  sequelize,
} = require("../../models");

const procurementCaseDetailIncludes = [
  { model: Indent, as: "indent" },
  { model: ProcurementEmployee, as: "procurement_officer" },
  {
    model: ProcurementCaseItem,
    as: "case_items",
    separate: true,
    order: [["id", "ASC"]],
    include: [
      {
        model: IndentItem,
        as: "indent_item",
        include: [
          { model: ItemCategory, as: "category" },
          { model: ItemSubcategory, as: "subcategory" },
          { model: ProcurementEmployee, as: "procurement_officer" },
        ],
      },
      {
        model: TenderItem,
        as: "tender_items",
        separate: true,
        order: [["id", "ASC"]],
        include: [{ model: Tender, as: "tender" }],
      },
    ],
  },
  {
    model: Tender,
    as: "tenders",
    separate: true,
    order: [["id", "DESC"]],
  },
];

class ProcurementCaseRepository {
  async listBase({ where = {}, limit, cursor, sortBy = "id", sortDirection = "DESC" } = {}) {
    return ProcurementCase.findAll({
      where: buildCursorWhere({ baseWhere: where, cursor, sortBy, sortDirection }),
      include: [
        { model: Indent, as: "indent" },
        { model: ProcurementEmployee, as: "procurement_officer" },
      ],
      order: buildSortOrder(sortBy, sortDirection),
      ...(limit ? { limit } : {}),
      subQuery: false,
    });
  }

  async findByPk(id, include = procurementCaseDetailIncludes) {
    return ProcurementCase.findByPk(id, { include });
  }

  async findIndentByPk(id) {
    return Indent.findByPk(id);
  }

  async findProcurementEmployeeByPk(id) {
    return ProcurementEmployee.findByPk(id);
  }

  async findProcurementEmployeeByEmpcode(empcode) {
    return ProcurementEmployee.findOne({ where: { empcode } });
  }

  async findIndentItemsByIds(itemIds = []) {
    return IndentItem.findAll({
      where: { id: itemIds },
      include: [
        { model: ItemCategory, as: "category" },
        { model: ItemSubcategory, as: "subcategory" },
        { model: ProcurementEmployee, as: "procurement_officer" },
      ],
      order: [["id", "ASC"]],
    });
  }

  async findCurrentOfficerIndentItems(indentId, officerId) {
    return IndentItem.findAll({
      where: {
        indent_id: indentId,
        assigned_procurement_officer_id: officerId,
      },
      include: [
        { model: ItemCategory, as: "category" },
        { model: ItemSubcategory, as: "subcategory" },
        { model: ProcurementEmployee, as: "procurement_officer" },
      ],
      order: [["id", "ASC"]],
    });
  }

  async findCaseLinksByItemIds(itemIds = []) {
    return ProcurementCaseItem.findAll({
      where: { indent_item_id: itemIds },
      include: [{ model: ProcurementCase, as: "procurement_case" }],
    });
  }

  async findCaseItemsByCaseIds(caseIds = []) {
    return ProcurementCaseItem.findAll({
      where: { procurement_case_id: caseIds },
      include: [
        {
          model: IndentItem,
          as: "indent_item",
          include: [
            { model: ItemCategory, as: "category" },
            { model: ItemSubcategory, as: "subcategory" },
            { model: ProcurementEmployee, as: "procurement_officer" },
          ],
        },
      ],
      order: [
        ["procurement_case_id", "ASC"],
        ["id", "ASC"],
      ],
    });
  }

  async findTendersByCaseIds(caseIds = []) {
    return Tender.findAll({
      where: { procurement_case_id: caseIds },
      order: [
        ["procurement_case_id", "ASC"],
        ["id", "DESC"],
      ],
    });
  }

  async withTransaction(callback) {
    return sequelize.transaction(callback);
  }

  async createProcurementCase(payload, { transaction } = {}) {
    return ProcurementCase.create(payload, { transaction });
  }

  async updateProcurementCase(procurementCase, payload, { transaction } = {}) {
    return procurementCase.update(payload, { transaction });
  }

  async findProcurementCaseByPk(id, options = {}) {
    return ProcurementCase.findByPk(id, options);
  }

  async updateProcurementCaseStatusIfAllowed(id, nextStatus, allowedStatuses = [], { transaction } = {}) {
    const where = { id };
    if (Array.isArray(allowedStatuses) && allowedStatuses.length) {
      where.status = allowedStatuses;
    }
    return ProcurementCase.update({ status: nextStatus }, { where, transaction });
  }

  async bulkCreateCaseItems(payload, { transaction } = {}) {
    return ProcurementCaseItem.bulkCreate(payload, { transaction });
  }

  async updateIndentItems(where, payload, { transaction } = {}) {
    return IndentItem.update(payload, { where, transaction });
  }
}

module.exports = {
  ProcurementCaseRepository,
  procurementCaseDetailIncludes,
};
