"use strict";

const { PROCUREMENT_CASE_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn(PROCUREMENT_CASE_TABLE, "approval_reference").catch(() => {});
    await queryInterface.removeColumn(PROCUREMENT_CASE_TABLE, "approval_date").catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn(PROCUREMENT_CASE_TABLE, "approval_reference", {
      type: Sequelize.STRING(160),
      allowNull: true,
    }).catch(() => {});
    await queryInterface.addColumn(PROCUREMENT_CASE_TABLE, "approval_date", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    }).catch(() => {});
  },
};
