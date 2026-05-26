const { Firm, FirmAddress, FirmContact, sequelize } = require("../../models");
const { buildCursorWhere, buildSortOrder } = require("../utils/procurement-domain");

const firmIncludes = [
  {
    model: FirmAddress,
    as: "addresses",
    separate: true,
    order: [
      ["is_primary", "DESC"],
      ["id", "ASC"],
    ],
  },
  {
    model: FirmContact,
    as: "contacts",
    separate: true,
    order: [
      ["is_primary", "DESC"],
      ["id", "ASC"],
    ],
  },
];

class FirmRepository {
  async list({ where = {}, limit, cursor, sortBy = "id", sortDirection = "DESC" } = {}) {
    return Firm.findAll({
      where: buildCursorWhere({ baseWhere: where, cursor, sortBy, sortDirection }),
      include: firmIncludes,
      order: buildSortOrder(sortBy, sortDirection),
      ...(limit ? { limit } : {}),
    });
  }

  async listTop({ where = {}, limit = 100 } = {}) {
    return Firm.findAll({
      where,
      include: firmIncludes,
      order: [["firm_name", "ASC"]],
      limit,
    });
  }

  async findByPk(id) {
    return Firm.findByPk(id, { include: firmIncludes });
  }

  async withTransaction(callback) {
    return sequelize.transaction(callback);
  }

  async createFirm(payload, { transaction } = {}) {
    return Firm.create(payload, { transaction });
  }

  async bulkCreateAddresses(payload, { transaction } = {}) {
    return FirmAddress.bulkCreate(payload, { transaction });
  }

  async bulkCreateContacts(payload, { transaction } = {}) {
    return FirmContact.bulkCreate(payload, { transaction });
  }
}

module.exports = FirmRepository;
