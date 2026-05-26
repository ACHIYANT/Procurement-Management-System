"use strict";

const { PURCHASE_ORDER_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable(PURCHASE_ORDER_TABLE);
    if (!table.warranty_period) {
      await queryInterface.addColumn(PURCHASE_ORDER_TABLE, "warranty_period", {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable(PURCHASE_ORDER_TABLE);
    if (table.warranty_period) {
      await queryInterface.removeColumn(PURCHASE_ORDER_TABLE, "warranty_period");
    }
  },
};
