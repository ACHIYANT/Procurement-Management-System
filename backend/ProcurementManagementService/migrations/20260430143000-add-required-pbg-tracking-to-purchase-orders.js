"use strict";

const { PURCHASE_ORDER_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(PURCHASE_ORDER_TABLE, "required_pbg_amount", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
      after: "po_value",
    });

    await queryInterface.addColumn(PURCHASE_ORDER_TABLE, "required_pbg_percentage", {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
      after: "required_pbg_amount",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(PURCHASE_ORDER_TABLE, "required_pbg_percentage");
    await queryInterface.removeColumn(PURCHASE_ORDER_TABLE, "required_pbg_amount");
  },
};
