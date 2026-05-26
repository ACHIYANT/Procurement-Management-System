"use strict";

const { DEPARTMENT_FUND_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(DEPARTMENT_FUND_TABLE, "vendor_name", {
      type: Sequelize.STRING(180),
      allowNull: true,
    });

    await queryInterface.addColumn(DEPARTMENT_FUND_TABLE, "payment_noting_path", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(DEPARTMENT_FUND_TABLE, "payment_noting_path");
    await queryInterface.removeColumn(DEPARTMENT_FUND_TABLE, "vendor_name");
  },
};
