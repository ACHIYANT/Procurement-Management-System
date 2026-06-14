"use strict";

const { Op } = require("sequelize");

const { buildCursorWhere, buildSortOrder } = require("../utils/procurement-domain");
const {
  Indent,
  IndentDocument,
  IndentItem,
  ItemCategory,
  ItemSubcategory,
  ProcurementEmployee,
  ProcurementCase,
  IndentItemEvent,
  sequelize,
} = require("../../models");

const indentDetailIncludes = [
  { model: ProcurementEmployee, as: "creator" },
  { model: ProcurementEmployee, as: "updater" },
  {
    model: IndentDocument,
    as: "documents",
    separate: true,
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    include: [{ model: ProcurementEmployee, as: "uploader" }],
  },
  {
    model: IndentItem,
    as: "items",
    separate: true,
      order: [["id", "ASC"]],
      include: [
        { model: ItemCategory, as: "category" },
        { model: ItemSubcategory, as: "subcategory" },
        { model: ProcurementEmployee, as: "procurement_officer" },
        { model: ProcurementEmployee, as: "estimated_by_officer" },
        {
          model: IndentItemEvent,
          as: "events",
          separate: true,
          order: [["event_at", "DESC"], ["id", "DESC"]],
          include: [
            { model: ProcurementEmployee, as: "actor" },
            { model: ProcurementEmployee, as: "from_officer" },
            { model: ProcurementEmployee, as: "to_officer" },
          ],
        },
      ],
    },
  {
    model: ProcurementCase,
    as: "procurement_cases",
    separate: true,
    order: [["id", "DESC"]],
  },
];

class IndentRepository {
  async listBase({ where = {}, limit, cursor, sortBy = "id", sortDirection = "DESC" } = {}) {
    return Indent.findAll({
      where: buildCursorWhere({ baseWhere: where, cursor, sortBy, sortDirection }),
      include: [{ model: ProcurementEmployee, as: "creator" }],
      order: buildSortOrder(sortBy, sortDirection),
      ...(limit ? { limit } : {}),
    });
  }

  async findByPk(id, include = indentDetailIncludes) {
    return Indent.findByPk(id, { include });
  }

  async findItemsByIndentIds(indentIds = []) {
    return IndentItem.findAll({
      where: { indent_id: indentIds },
      include: [
        { model: ItemCategory, as: "category" },
        { model: ItemSubcategory, as: "subcategory" },
        { model: ProcurementEmployee, as: "procurement_officer" },
        { model: ProcurementEmployee, as: "estimated_by_officer" },
        {
          model: IndentItemEvent,
          as: "events",
          separate: true,
          order: [["event_at", "DESC"], ["id", "DESC"]],
          include: [
            { model: ProcurementEmployee, as: "actor" },
            { model: ProcurementEmployee, as: "from_officer" },
            { model: ProcurementEmployee, as: "to_officer" },
          ],
        },
      ],
      order: [
        ["indent_id", "ASC"],
        ["id", "ASC"],
      ],
    });
  }

  async findCasesByIndentIds(indentIds = []) {
    return ProcurementCase.findAll({
      where: { indent_id: indentIds },
      order: [
        ["indent_id", "ASC"],
        ["id", "DESC"],
      ],
    });
  }

  async findProcurementEmployeeByPk(id) {
    return ProcurementEmployee.findByPk(id);
  }

  async findProcurementEmployeeByEmpcode(empcode) {
    return ProcurementEmployee.findOne({
      where: {
        empcode,
      },
    });
  }

  async findItemCategoryByPk(id) {
    return ItemCategory.findByPk(id);
  }

  async findItemSubcategoryByPk(id) {
    return ItemSubcategory.findByPk(id);
  }

  async withTransaction(callback) {
    return sequelize.transaction(callback);
  }

  async createIndent(payload, { transaction } = {}) {
    return Indent.create(payload, { transaction });
  }

  async countIndentsInFinancialYear(startDate, endDate, { transaction } = {}) {
    return Indent.count({
      where: {
        received_date: {
          [Op.gte]: startDate,
          [Op.lte]: endDate,
        },
        status: {
          [Op.ne]: "draft",
        },
      },
      transaction,
    });
  }

  async updateIndent(indent, payload, { transaction } = {}) {
    return indent.update(payload, { transaction });
  }

  async createIndentDocument(payload, { transaction } = {}) {
    return IndentDocument.create(payload, { transaction });
  }

  async bulkCreateItems(payload, { transaction } = {}) {
    return IndentItem.bulkCreate(payload, { transaction });
  }

  async deleteItemsByIndentId(indentId, { transaction } = {}) {
    return IndentItem.destroy({
      where: { indent_id: indentId },
      transaction,
    });
  }

  async findIndentItemByPk(id, { transaction } = {}) {
    return IndentItem.findByPk(id, {
      transaction,
      include: [
        { model: ItemCategory, as: "category" },
        { model: ItemSubcategory, as: "subcategory" },
        { model: ProcurementEmployee, as: "procurement_officer" },
        { model: ProcurementEmployee, as: "estimated_by_officer" },
        {
          model: IndentItemEvent,
          as: "events",
          separate: true,
          order: [["event_at", "DESC"], ["id", "DESC"]],
          include: [
            { model: ProcurementEmployee, as: "actor" },
            { model: ProcurementEmployee, as: "from_officer" },
            { model: ProcurementEmployee, as: "to_officer" },
          ],
        },
      ],
    });
  }

  async updateIndentItem(item, payload, { transaction } = {}) {
    return item.update(payload, { transaction });
  }

  async createIndentItemEvent(payload, { transaction } = {}) {
    return IndentItemEvent.create(payload, { transaction });
  }

  async listWorkQueueByOfficerId(procurementOfficerId) {
    return IndentItem.findAll({
      where: {
        assigned_procurement_officer_id: procurementOfficerId,
      },
      include: [
        {
          model: Indent,
          as: "indent",
          include: [{ model: ProcurementEmployee, as: "creator" }],
        },
        { model: ProcurementEmployee, as: "procurement_officer" },
        { model: ProcurementEmployee, as: "estimated_by_officer" },
      ],
      order: [
        ["assignment_status", "ASC"],
        [{ model: Indent, as: "indent" }, "createdAt", "DESC"],
        ["updatedAt", "DESC"],
      ],
    });
  }
}

module.exports = {
  IndentRepository,
  indentDetailIncludes,
};
