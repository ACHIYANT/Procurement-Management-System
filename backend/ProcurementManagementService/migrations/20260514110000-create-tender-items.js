"use strict";

const {
  INDENT_ITEM_TABLE,
  PROCUREMENT_CASE_ITEM_TABLE,
  TENDER_ITEM_TABLE,
  TENDER_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TENDER_ITEM_TABLE, {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      tender_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: TENDER_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      procurement_case_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: PROCUREMENT_CASE_ITEM_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      indent_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: INDENT_ITEM_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      tender_quantity: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
      },
      unit: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },
      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex(TENDER_ITEM_TABLE, ["tender_id", "procurement_case_item_id"], {
      name: "tender_items_tender_case_item_unique",
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TENDER_ITEM_TABLE).catch(() => {});
  },
};
