const { Op } = require("sequelize");
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

  async findIdentityConflict({ firmCode, firmName, gstNo, panNo } = {}) {
    const orConditions = [];
    if (firmCode) orConditions.push({ firm_code: firmCode });
    if (gstNo) orConditions.push({ gst_no: gstNo });
    if (panNo) orConditions.push({ pan_no: panNo });
    if (firmName) {
      orConditions.push(
        sequelize.where(
          sequelize.fn("LOWER", sequelize.fn("TRIM", sequelize.col("firm_name"))),
          String(firmName).trim().replace(/\s+/g, " ").toLowerCase(),
        ),
      );
    }
    if (!orConditions.length) return null;
    return Firm.findOne({
      where: { [Op.or]: orConditions },
      include: firmIncludes,
    });
  }

  async findContactConflict(contactValues = []) {
    const values = Array.from(new Set(contactValues.filter(Boolean)));
    if (!values.length) return null;
    return FirmContact.findOne({
      where: { contact_value: { [Op.in]: values } },
      include: [{ model: Firm, as: "firm" }],
    });
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
