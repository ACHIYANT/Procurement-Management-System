"use strict";

const { PROCUREMENT_EMPLOYEE_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      `SELECT id, assigned_roles FROM ${PROCUREMENT_EMPLOYEE_TABLE}`,
    );

    for (const row of rows) {
      let parsedRoles = [];
      try {
        parsedRoles = Array.isArray(row.assigned_roles)
          ? row.assigned_roles
          : JSON.parse(row.assigned_roles || "[]");
      } catch {
        parsedRoles = [];
      }

      const nextRoles = Array.from(
        new Set(
          parsedRoles.map((role) => {
            const normalizedRole = String(role || "").trim().toUpperCase();
            if (normalizedRole === "DEALING_OFFICER") return "PROCUREMENT_OFFICER";
            if (normalizedRole === "PROCUREMENT_ASSISTANT") return "ASSOCIATE";
            return normalizedRole;
          }),
        ),
      );

      if (JSON.stringify(parsedRoles) === JSON.stringify(nextRoles)) continue;

      await queryInterface.sequelize.query(
        `UPDATE ${PROCUREMENT_EMPLOYEE_TABLE}
            SET assigned_roles = :assignedRoles, updatedAt = :updatedAt
          WHERE id = :id`,
        {
          replacements: {
            id: row.id,
            assignedRoles: JSON.stringify(nextRoles),
            updatedAt: new Date(),
          },
        },
      );
    }
  },

  async down(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      `SELECT id, assigned_roles FROM ${PROCUREMENT_EMPLOYEE_TABLE}`,
    );

    for (const row of rows) {
      let parsedRoles = [];
      try {
        parsedRoles = Array.isArray(row.assigned_roles)
          ? row.assigned_roles
          : JSON.parse(row.assigned_roles || "[]");
      } catch {
        parsedRoles = [];
      }

      const previousRoles = Array.from(
        new Set(
          parsedRoles.map((role) => {
            const normalizedRole = String(role || "").trim().toUpperCase();
            if (normalizedRole === "PROCUREMENT_OFFICER") return "DEALING_OFFICER";
            if (normalizedRole === "ASSOCIATE") return "PROCUREMENT_ASSISTANT";
            return normalizedRole;
          }),
        ),
      );

      if (JSON.stringify(parsedRoles) === JSON.stringify(previousRoles)) continue;

      await queryInterface.sequelize.query(
        `UPDATE ${PROCUREMENT_EMPLOYEE_TABLE}
            SET assigned_roles = :assignedRoles, updatedAt = :updatedAt
          WHERE id = :id`,
        {
          replacements: {
            id: row.id,
            assignedRoles: JSON.stringify(previousRoles),
            updatedAt: new Date(),
          },
        },
      );
    }
  },
};
