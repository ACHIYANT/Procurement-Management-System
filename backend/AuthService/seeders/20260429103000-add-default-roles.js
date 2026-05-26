"use strict";

const { ROLE_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const requiredRoles = [
      "USER",
      "ADMIN",
      "SUPER_ADMIN",
      "PROCUREMENT_OFFICER",
      "ASSOCIATE",
      "FINANCE_OFFICER",
      "APPROVER",
      "VIEWER",
    ];
    const [existingRoles] = await queryInterface.sequelize.query(
      `SELECT name FROM ${ROLE_TABLE} WHERE name IN (:names)`,
      {
        replacements: { names: requiredRoles },
      },
    );
    const existingRoleNames = new Set(existingRoles.map((role) => role.name));
    const rolesToCreate = requiredRoles
      .filter((name) => !existingRoleNames.has(name))
      .map((name) => ({
        name,
        createdAt: now,
        updatedAt: now,
      }));

    if (rolesToCreate.length) {
      await queryInterface.bulkInsert(ROLE_TABLE, rolesToCreate, {});
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(ROLE_TABLE, {
      name: [
        "USER",
        "ADMIN",
        "SUPER_ADMIN",
        "PROCUREMENT_OFFICER",
        "ASSOCIATE",
        "FINANCE_OFFICER",
        "APPROVER",
        "VIEWER",
      ],
    });
  },
};
