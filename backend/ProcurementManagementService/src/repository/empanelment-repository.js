const { Op } = require("sequelize");
const { buildCursorWhere, buildSortOrder } = require("../utils/procurement-domain");
const {
  Empanelment,
  EmpanelmentItemCategory,
  EmpanelmentOem,
  EmpanelmentExtension,
  Firm,
  sequelize,
} = require("../../models");

const detailIncludes = [
  { model: Firm, as: "firm" },
  {
    model: EmpanelmentItemCategory,
    as: "item_categories",
    separate: true,
    order: [["id", "ASC"]],
    include: [
      {
        model: EmpanelmentOem,
        as: "oems",
        separate: true,
        order: [["id", "ASC"]],
      },
    ],
  },
  {
    model: EmpanelmentExtension,
    as: "extensions",
    separate: true,
    order: [["extended_upto", "DESC"], ["id", "DESC"]],
  },
];

class EmpanelmentRepository {
  async listBase({ where = {}, limit, cursor, sortBy = "id", sortDirection = "DESC" } = {}) {
    return Empanelment.findAll({
      where: buildCursorWhere({ baseWhere: where, cursor, sortBy, sortDirection }),
      include: [{ model: Firm, as: "firm" }],
      order: buildSortOrder(sortBy, sortDirection),
      ...(limit ? { limit } : {}),
      subQuery: false,
    });
  }

  async findByPk(id) {
    return Empanelment.findByPk(id, { include: detailIncludes });
  }

  async findFirmByPk(id) {
    return Firm.findByPk(id);
  }

  async findCategoriesByEmpanelmentIds(empanelmentIds = []) {
    return EmpanelmentItemCategory.findAll({
      where: { empanelment_id: { [Op.in]: empanelmentIds } },
      include: [{ model: EmpanelmentOem, as: "oems" }],
      order: [
        ["empanelment_id", "ASC"],
        ["id", "ASC"],
      ],
    });
  }

  async findExtensionsByEmpanelmentIds(empanelmentIds = []) {
    return EmpanelmentExtension.findAll({
      where: { empanelment_id: { [Op.in]: empanelmentIds } },
      order: [
        ["empanelment_id", "ASC"],
        ["extended_upto", "DESC"],
        ["id", "DESC"],
      ],
    });
  }

  async withTransaction(callback) {
    return sequelize.transaction(callback);
  }

  async createEmpanelment(payload, { transaction } = {}) {
    return Empanelment.create(payload, { transaction });
  }

  async createItemCategory(payload, { transaction } = {}) {
    return EmpanelmentItemCategory.create(payload, { transaction });
  }

  async bulkCreateOems(payload, { transaction } = {}) {
    return EmpanelmentOem.bulkCreate(payload, { transaction });
  }

  async createExtension(payload, { transaction } = {}) {
    return EmpanelmentExtension.create(payload, { transaction });
  }

  async updateEmpanelment(instance, payload, { transaction } = {}) {
    return instance.update(payload, { transaction });
  }
}

module.exports = EmpanelmentRepository;
