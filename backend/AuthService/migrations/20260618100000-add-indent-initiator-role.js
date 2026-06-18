"use strict";

const { ROLE_TABLE } = require("../src/constants/table-names");

const ROLE_NAME = "INDENT_INITIATOR";

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existingRoles] = await queryInterface.sequelize.query(
      `SELECT id FROM ${ROLE_TABLE} WHERE name = :name LIMIT 1`,
      {
        replacements: { name: ROLE_NAME },
      },
    );

    if (!existingRoles.length) {
      await queryInterface.bulkInsert(
        ROLE_TABLE,
        [
          {
            name: ROLE_NAME,
            createdAt: now,
            updatedAt: now,
          },
        ],
        {},
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(ROLE_TABLE, { name: ROLE_NAME });
  },
};
