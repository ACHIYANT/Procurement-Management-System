"use strict";

const {
  TENDER_VENDOR_ITEM_QUOTE_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      TENDER_VENDOR_ITEM_QUOTE_TABLE,
      "negotiated_amount",
      {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      TENDER_VENDOR_ITEM_QUOTE_TABLE,
      "negotiated_amount",
    );
  },
};
