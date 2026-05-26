"use strict";

const { PURCHASE_ORDER_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable(PURCHASE_ORDER_TABLE);
    if (!table.po_document_path) {
      await queryInterface.addColumn(PURCHASE_ORDER_TABLE, "po_document_path", {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable(PURCHASE_ORDER_TABLE);
    if (table.po_document_path) {
      await queryInterface.removeColumn(PURCHASE_ORDER_TABLE, "po_document_path");
    }
  },
};
