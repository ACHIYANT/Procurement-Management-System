"use strict";

const { TENDER_VENDOR_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(TENDER_VENDOR_TABLE, "loa_allocation_basis", {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
    await queryInterface.addColumn(TENDER_VENDOR_TABLE, "loa_allocated_quantity", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
    });
    await queryInterface.addColumn(TENDER_VENDOR_TABLE, "loa_allocated_amount", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(TENDER_VENDOR_TABLE, "loa_allocated_amount");
    await queryInterface.removeColumn(TENDER_VENDOR_TABLE, "loa_allocated_quantity");
    await queryInterface.removeColumn(TENDER_VENDOR_TABLE, "loa_allocation_basis");
  },
};
