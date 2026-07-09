"use strict";

const { Op } = require("sequelize");
const { User, Role, LoginAudit, sequelize } = require("../../models");

const DEFAULT_ROLE_NAME = "USER";

const normalizeRoleName = (roleName) => {
  const normalized = String(roleName || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");

  if (normalized === "DEALING_OFFICER") return "PROCUREMENT_OFFICER";
  if (normalized === "PROCUREMENT_ASSISTANT") return "ASSOCIATE";
  return normalized;
};

const normalizeRoleList = (roleNames = []) =>
  Array.from(
    new Set(
      (Array.isArray(roleNames) ? roleNames : [])
        .map(normalizeRoleName)
        .filter(Boolean),
    ),
  );

class UserRepository {
  async ensureRoles(roleNames = [], transaction) {
    const requestedRoles = normalizeRoleList(roleNames);
    if (!requestedRoles.length) return [];

    const existingRoles = await Role.findAll({
      where: { name: requestedRoles },
      transaction,
    });
    const existingRoleNames = new Set(existingRoles.map((role) => role.name));
    const missingRoles = requestedRoles.filter((roleName) => !existingRoleNames.has(roleName));

    if (missingRoles.length) {
      const now = new Date();
      await Role.bulkCreate(
        missingRoles.map((roleName) => ({
          name: roleName,
          createdAt: now,
          updatedAt: now,
        })),
        { transaction, ignoreDuplicates: true },
      );
    }

    return Role.findAll({
      where: { name: requestedRoles },
      transaction,
    });
  }

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

  async createLoginAudit(payload = {}) {
    return LoginAudit.create(payload);
  }

  async listLoginAudits(filters = {}) {
    const where = {};
    const userWhere = {};

    if (String(filters.empcode || "").trim()) {
      where.empcode = String(filters.empcode).trim();
    }
    if (String(filters.userSearch || "").trim()) {
      const search = `%${String(filters.userSearch).trim()}%`;
      userWhere[Op.or] = [
        { fullname: { [Op.like]: search } },
        { empcode: { [Op.like]: search } },
        { mobileno: { [Op.like]: search } },
      ];
    }
    if (filters.dateFrom || filters.dateTo) {
      where.login_at = {};
      if (filters.dateFrom) where.login_at[Op.gte] = filters.dateFrom;
      if (filters.dateTo) where.login_at[Op.lte] = filters.dateTo;
    }

    const limit = Math.min(Math.max(Number(filters.limit || 50), 1), 200);
    const offset = Math.max(Number(filters.offset || 0), 0);

    const result = await LoginAudit.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "empcode",
            "fullname",
            "mobileno",
            "designation",
            "department",
          ],
          where: Object.keys(userWhere).length ? userWhere : undefined,
          required: Object.keys(userWhere).length > 0,
        },
      ],
      order: [
        ["login_at", "DESC"],
        ["id", "DESC"],
      ],
      limit,
      offset,
    });

    return {
      rows: result.rows,
      meta: {
        total: result.count,
        limit,
        offset,
        hasMore: offset + result.rows.length < result.count,
      },
    };
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
    const userId = await sequelize.transaction(async (transaction) => {
      const user = await User.create(payload, { transaction });
      const requestedRoles = Array.from(
        new Set(
          [DEFAULT_ROLE_NAME]
            .concat(Array.isArray(options.roleNames) ? options.roleNames : [])
            .map(normalizeRoleName)
            .filter(Boolean),
        ),
      );
      const assignableRoles = await this.ensureRoles(requestedRoles, transaction);
      if (assignableRoles.length) {
        await user.addRoles(assignableRoles, { transaction });
      }
      return user.id;
    });

    return this.getById(userId);
  }

  async syncEmployeeRolesByEmpcode(payload = {}) {
    const empcode = String(payload.empcode || "").trim();
    if (!empcode) {
      const error = new Error("Employee code is required for role sync.");
      error.statusCode = 400;
      throw error;
    }

    const userId = await sequelize.transaction(async (transaction) => {
      const user = await User.findOne({
        where: { empcode },
        transaction,
      });

      if (!user) return null;

      const updatePayload = {};
      if (String(payload.fullname || "").trim()) {
        updatePayload.fullname = String(payload.fullname).trim().replace(/\s+/g, " ");
      }
      if (String(payload.mobileno || "").trim()) {
        updatePayload.mobileno = String(payload.mobileno).replace(/\D/g, "").trim();
      }
      if (String(payload.designation || "").trim()) {
        updatePayload.designation = String(payload.designation).trim().replace(/\s+/g, " ");
      }
      if (String(payload.department || payload.division || "").trim()) {
        updatePayload.department = String(payload.department || payload.division)
          .trim()
          .replace(/\s+/g, " ");
      }
      if (String(payload.location_scope || "").trim()) {
        updatePayload.location_scope = String(payload.location_scope)
          .trim()
          .replace(/\s+/g, " ")
          .toUpperCase();
      }

      if (Object.keys(updatePayload).length) {
        await user.update(updatePayload, { transaction });
      }

      const assignedRoles = normalizeRoleList(payload.assigned_roles);
      const targetRoles = normalizeRoleList([DEFAULT_ROLE_NAME, ...assignedRoles]);
      const assignableRoles = await this.ensureRoles(targetRoles, transaction);
      await user.setRoles(assignableRoles, { transaction });

      return user.id;
    });

    return userId ? this.getById(userId) : null;
  }
}

module.exports = UserRepository;
