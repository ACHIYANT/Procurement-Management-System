"use strict";

const {
  ROLE_TABLE,
  USER_ROLE_TABLE,
} = require("../src/constants/table-names");

async function findRoleByName(queryInterface, name) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT id, name FROM ${ROLE_TABLE} WHERE name = :name LIMIT 1`,
    {
      replacements: { name },
    },
  );

  return rows?.[0] || null;
}

async function attachMissingMappings(queryInterface, fromRoleId, toRoleId) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT ur.user_id
       FROM ${USER_ROLE_TABLE} ur
      WHERE ur.role_id = :fromRoleId
        AND NOT EXISTS (
          SELECT 1
            FROM ${USER_ROLE_TABLE} existing
           WHERE existing.user_id = ur.user_id
             AND existing.role_id = :toRoleId
        )`,
    {
      replacements: { fromRoleId, toRoleId },
    },
  );

  if (!rows?.length) return;

  const now = new Date();
  await queryInterface.bulkInsert(
    USER_ROLE_TABLE,
    rows.map((row) => ({
      user_id: row.user_id,
      role_id: toRoleId,
      createdAt: now,
      updatedAt: now,
    })),
    {},
  );
}

module.exports = {
  async up(queryInterface) {
    const legacyRole = await findRoleByName(queryInterface, "DEALING_OFFICER");
    if (!legacyRole) return;

    const targetRole = await findRoleByName(queryInterface, "PROCUREMENT_OFFICER");

    if (!targetRole) {
      await queryInterface.sequelize.query(
        `UPDATE ${ROLE_TABLE} SET name = :nextName, updatedAt = :updatedAt WHERE id = :id`,
        {
          replacements: {
            id: legacyRole.id,
            nextName: "PROCUREMENT_OFFICER",
            updatedAt: new Date(),
          },
        },
      );
      return;
    }

    await attachMissingMappings(queryInterface, legacyRole.id, targetRole.id);
    await queryInterface.bulkDelete(USER_ROLE_TABLE, { role_id: legacyRole.id });
    await queryInterface.bulkDelete(ROLE_TABLE, { id: legacyRole.id });
  },

  async down(queryInterface) {
    const targetRole = await findRoleByName(queryInterface, "PROCUREMENT_OFFICER");
    if (!targetRole) return;

    const legacyRole = await findRoleByName(queryInterface, "DEALING_OFFICER");

    if (!legacyRole) {
      await queryInterface.sequelize.query(
        `UPDATE ${ROLE_TABLE} SET name = :nextName, updatedAt = :updatedAt WHERE id = :id`,
        {
          replacements: {
            id: targetRole.id,
            nextName: "DEALING_OFFICER",
            updatedAt: new Date(),
          },
        },
      );
      return;
    }

    await attachMissingMappings(queryInterface, targetRole.id, legacyRole.id);
    await queryInterface.bulkDelete(USER_ROLE_TABLE, { role_id: targetRole.id });
    await queryInterface.bulkDelete(ROLE_TABLE, { id: targetRole.id });
  },
};
