"use strict";

const bcrypt = require("bcrypt");
const {
  ROLE_TABLE,
  USER_ROLE_TABLE,
  USER_TABLE,
} = require("../src/constants/table-names");

const DUMMY_USER = {
  empcode: "PMSADMIN002",
  fullname: "PMS Admin User",
  mobileno: "9876543211",
  designation: "Procurement Admin",
  department: "Procurement",
  location_scope: "PANCHKULA",
};

const DUMMY_PASSWORD = process.env.PMS_DUMMY_ADMIN_ONLY_PASSWORD || "Admin@123";
const DUMMY_ROLES = ["ADMIN"];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existingUsers] = await queryInterface.sequelize.query(
      `SELECT id FROM ${USER_TABLE} WHERE empcode = :empcode OR mobileno = :mobileno LIMIT 1`,
      {
        replacements: {
          empcode: DUMMY_USER.empcode,
          mobileno: DUMMY_USER.mobileno,
        },
      },
    );

    let userId = existingUsers?.[0]?.id;

    if (!userId) {
      const password = await bcrypt.hash(DUMMY_PASSWORD, 12);
      const [result] = await queryInterface.sequelize.query(
        `INSERT INTO ${USER_TABLE}
          (empcode, fullname, mobileno, password, designation, department, location_scope, must_change_password, password_version, password_changed_at, createdAt, updatedAt)
         VALUES
          (:empcode, :fullname, :mobileno, :password, :designation, :department, :location_scope, :must_change_password, :password_version, :password_changed_at, :createdAt, :updatedAt)`,
        {
          replacements: {
            ...DUMMY_USER,
            password,
            must_change_password: false,
            password_version: 0,
            password_changed_at: now,
            createdAt: now,
            updatedAt: now,
          },
        },
      );

      userId = result;
    }

    const [roles] = await queryInterface.sequelize.query(
      `SELECT id, name FROM ${ROLE_TABLE} WHERE name IN (:names)`,
      {
        replacements: { names: DUMMY_ROLES },
      },
    );

    if (!roles?.length || !userId) return;

    const roleIds = roles.map((role) => role.id);
    const [existingMappings] = await queryInterface.sequelize.query(
      `SELECT role_id FROM ${USER_ROLE_TABLE} WHERE user_id = :userId AND role_id IN (:roleIds)`,
      {
        replacements: { userId, roleIds },
      },
    );
    const existingRoleIds = new Set(existingMappings.map((mapping) => mapping.role_id));
    const mappingsToCreate = roleIds
      .filter((roleId) => !existingRoleIds.has(roleId))
      .map((roleId) => ({
        user_id: userId,
        role_id: roleId,
        createdAt: now,
        updatedAt: now,
      }));

    if (mappingsToCreate.length) {
      await queryInterface.bulkInsert(USER_ROLE_TABLE, mappingsToCreate, {});
    }
  },

  async down(queryInterface) {
    const [users] = await queryInterface.sequelize.query(
      `SELECT id FROM ${USER_TABLE} WHERE empcode = :empcode OR mobileno = :mobileno LIMIT 1`,
      {
        replacements: {
          empcode: DUMMY_USER.empcode,
          mobileno: DUMMY_USER.mobileno,
        },
      },
    );

    const userId = users?.[0]?.id;
    if (!userId) return;

    await queryInterface.bulkDelete(USER_ROLE_TABLE, { user_id: userId });
    await queryInterface.bulkDelete(USER_TABLE, { id: userId });
  },
};
