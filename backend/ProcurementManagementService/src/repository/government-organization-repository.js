"use strict";

const { Op } = require("sequelize");
const { GovernmentOrganization, sequelize } = require("../../models");

const normalizeKey = (value) =>
  String(value || "").trim().replace(/\s+/g, " ").toLowerCase();

class GovernmentOrganizationRepository {
  async list({ activeOnly = false, search = "" } = {}) {
    const where = {};
    if (activeOnly) where.is_active = true;
    if (String(search || "").trim()) {
      const like = `%${String(search).trim()}%`;
      where[Op.or] = [
        { organization_name: { [Op.like]: like } },
        { organization_code: { [Op.like]: like } },
        { organization_group: { [Op.like]: like } },
      ];
    }

    return GovernmentOrganization.findAll({
      where,
      order: [
        ["sort_order", "ASC"],
        ["organization_name", "ASC"],
      ],
    });
  }

  async findByPk(id) {
    return GovernmentOrganization.findByPk(id);
  }

  async findByCode(code) {
    return GovernmentOrganization.findOne({
      where: sequelize.where(
        sequelize.fn("LOWER", sequelize.fn("TRIM", sequelize.col("organization_code"))),
        normalizeKey(code),
      ),
    });
  }

  async findByGroupAndName(group, name) {
    return GovernmentOrganization.findOne({
      where: {
        [Op.and]: [
          sequelize.where(
            sequelize.fn("LOWER", sequelize.fn("TRIM", sequelize.col("organization_group"))),
            normalizeKey(group),
          ),
          sequelize.where(
            sequelize.fn("LOWER", sequelize.fn("TRIM", sequelize.col("organization_name"))),
            normalizeKey(name),
          ),
        ],
      },
    });
  }

  async create(payload, options = {}) {
    return GovernmentOrganization.create(payload, options);
  }

  async update(instance, payload, options = {}) {
    return instance.update(payload, options);
  }
}

module.exports = GovernmentOrganizationRepository;
