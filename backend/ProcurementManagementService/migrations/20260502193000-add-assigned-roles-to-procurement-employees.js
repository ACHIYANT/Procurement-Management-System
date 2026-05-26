"use strict";

const { PROCUREMENT_EMPLOYEE_TABLE } = require("../src/constants/table-names");

async function hasColumn(queryInterface, tableName, columnName) {
  const definition = await queryInterface.describeTable(tableName);
  return Object.prototype.hasOwnProperty.call(definition, columnName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const hasAssignedRoles = await hasColumn(queryInterface, PROCUREMENT_EMPLOYEE_TABLE, "assigned_roles");
    if (!hasAssignedRoles) {
      await queryInterface.addColumn(PROCUREMENT_EMPLOYEE_TABLE, "assigned_roles", {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "[]",
      });
    }
  },

  async down(queryInterface) {
    const hasAssignedRoles = await hasColumn(queryInterface, PROCUREMENT_EMPLOYEE_TABLE, "assigned_roles");
    if (hasAssignedRoles) {
      await queryInterface.removeColumn(PROCUREMENT_EMPLOYEE_TABLE, "assigned_roles");
    }
  },
};
