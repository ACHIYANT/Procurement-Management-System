"use strict";

const {
  INDENT_TABLE,
  TENDER_ITEM_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(INDENT_TABLE, "system_indent_no", {
      type: Sequelize.STRING(140),
      allowNull: true,
      after: "id",
    });
    await queryInterface.addIndex(INDENT_TABLE, ["system_indent_no"], {
      name: "indents_system_indent_no_idx",
      unique: true,
    });

    await queryInterface.addColumn(TENDER_ITEM_TABLE, "tender_value", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
      after: "tender_quantity",
    });
    await queryInterface.changeColumn(TENDER_ITEM_TABLE, "tender_quantity", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn(TENDER_ITEM_TABLE, "tender_quantity", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
    });
    await queryInterface.removeColumn(TENDER_ITEM_TABLE, "tender_value");
    await queryInterface.removeIndex(INDENT_TABLE, "indents_system_indent_no_idx");
    await queryInterface.removeColumn(INDENT_TABLE, "system_indent_no");
  },
};
