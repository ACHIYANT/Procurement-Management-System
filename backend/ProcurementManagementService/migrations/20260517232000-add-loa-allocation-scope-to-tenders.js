"use strict";

const { TENDER_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(TENDER_TABLE, "loa_allocation_scope", {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(TENDER_TABLE, "loa_allocation_scope");
  },
};
