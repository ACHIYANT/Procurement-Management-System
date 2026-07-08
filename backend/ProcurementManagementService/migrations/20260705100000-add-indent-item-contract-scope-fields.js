"use strict";

const { INDENT_ITEM_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(INDENT_ITEM_TABLE, "procurement_scope_type", {
      type: Sequelize.STRING(40),
      allowNull: false,
      defaultValue: "standard_quantity",
    });
    await queryInterface.addColumn(INDENT_ITEM_TABLE, "contract_period_value", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn(INDENT_ITEM_TABLE, "contract_period_unit", {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
    await queryInterface.addColumn(INDENT_ITEM_TABLE, "contract_value_limit", {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: true,
    });
    await queryInterface.addColumn(INDENT_ITEM_TABLE, "scope_remarks", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(INDENT_ITEM_TABLE, "scope_remarks");
    await queryInterface.removeColumn(INDENT_ITEM_TABLE, "contract_value_limit");
    await queryInterface.removeColumn(INDENT_ITEM_TABLE, "contract_period_unit");
    await queryInterface.removeColumn(INDENT_ITEM_TABLE, "contract_period_value");
    await queryInterface.removeColumn(INDENT_ITEM_TABLE, "procurement_scope_type");
  },
};
