"use strict";

const { PROCUREMENT_EMPLOYEE_TABLE } = require("../src/constants/table-names");

async function hasColumn(queryInterface, tableName, columnName) {
  const definition = await queryInterface.describeTable(tableName);
  return Object.prototype.hasOwnProperty.call(definition, columnName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const hasDepartment = await hasColumn(queryInterface, PROCUREMENT_EMPLOYEE_TABLE, "department");
    const hasDivision = await hasColumn(queryInterface, PROCUREMENT_EMPLOYEE_TABLE, "division");

    if (hasDepartment && !hasDivision) {
      await queryInterface.renameColumn(PROCUREMENT_EMPLOYEE_TABLE, "department", "division");
      return;
    }

    if (!hasDepartment && !hasDivision) {
      await queryInterface.addColumn(PROCUREMENT_EMPLOYEE_TABLE, "division", {
        type: Sequelize.STRING(120),
        allowNull: false,
        defaultValue: "GENERAL",
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const hasDepartment = await hasColumn(queryInterface, PROCUREMENT_EMPLOYEE_TABLE, "department");
    const hasDivision = await hasColumn(queryInterface, PROCUREMENT_EMPLOYEE_TABLE, "division");

    if (hasDivision && !hasDepartment) {
      await queryInterface.renameColumn(PROCUREMENT_EMPLOYEE_TABLE, "division", "department");
      return;
    }

    if (!hasDivision && !hasDepartment) {
      await queryInterface.addColumn(PROCUREMENT_EMPLOYEE_TABLE, "department", {
        type: Sequelize.STRING(120),
        allowNull: false,
        defaultValue: "GENERAL",
      });
    }
  },
};
