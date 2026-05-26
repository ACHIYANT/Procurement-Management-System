"use strict";

const {
  TENDER_VENDOR_ITEM_QUOTE_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(TENDER_VENDOR_ITEM_QUOTE_TABLE, "make", {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
    await queryInterface.addColumn(TENDER_VENDOR_ITEM_QUOTE_TABLE, "model", {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
    await queryInterface.changeColumn(TENDER_VENDOR_ITEM_QUOTE_TABLE, "quoted_amount", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn(TENDER_VENDOR_ITEM_QUOTE_TABLE, "quoted_amount", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
    });
    await queryInterface.removeColumn(TENDER_VENDOR_ITEM_QUOTE_TABLE, "model");
    await queryInterface.removeColumn(TENDER_VENDOR_ITEM_QUOTE_TABLE, "make");
  },
};
