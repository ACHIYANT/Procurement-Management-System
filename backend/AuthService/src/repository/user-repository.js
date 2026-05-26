"use strict";

const { Op } = require("sequelize");
const { User, Role, sequelize } = require("../../models");

const DEFAULT_ROLE_NAME = "USER";

class UserRepository {
  async getByEmpcode(empcode) {
    return User.findOne({
      where: { empcode: String(empcode || "").trim() },
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
      ],
    });
  }

  async getByMobileNo(mobileno) {
    return User.findOne({
      where: { mobileno: String(mobileno || "").trim() },
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
      ],
    });
  }

  async getById(id) {
    return User.findByPk(id, {
      attributes: [
        "id",
        "empcode",
        "fullname",
        "mobileno",
        "designation",
        "department",
        "location_scope",
        "must_change_password",
        "password_version",
        "password_changed_at",
      ],
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
      ],
    });
  }

  async findConflictingUser({ empcode, mobileno }) {
    const filters = [];
    if (String(empcode || "").trim()) {
      filters.push({ empcode: String(empcode).trim() });
    }
    if (String(mobileno || "").trim()) {
      filters.push({ mobileno: String(mobileno).trim() });
    }
    if (!filters.length) return null;

    return User.findOne({
      where: {
        [Op.or]: filters,
      },
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
      ],
    });
  }

  async create(payload, options = {}) {
    return sequelize.transaction(async (transaction) => {
      const user = await User.create(payload, { transaction });
      const requestedRoles = Array.from(
        new Set(
          [DEFAULT_ROLE_NAME]
            .concat(Array.isArray(options.roleNames) ? options.roleNames : [])
            .map((roleName) => String(roleName || "").trim().toUpperCase())
            .filter(Boolean),
        ),
      );
      const assignableRoles = await Role.findAll({
        where: { name: requestedRoles },
        transaction,
      });
      if (assignableRoles.length) {
        await user.addRoles(assignableRoles, { transaction });
      }
      return this.getById(user.id);
    });
  }
}

module.exports = UserRepository;
