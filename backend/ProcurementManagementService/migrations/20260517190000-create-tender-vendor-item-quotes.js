"use strict";

const {
  TENDER_VENDOR_ITEM_QUOTE_TABLE,
  TENDER_VENDOR_TABLE,
  TENDER_ITEM_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TENDER_VENDOR_ITEM_QUOTE_TABLE, {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      tender_vendor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: TENDER_VENDOR_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      tender_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: TENDER_ITEM_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      quoted_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
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

    await queryInterface.addIndex(
      TENDER_VENDOR_ITEM_QUOTE_TABLE,
      ["tender_vendor_id", "tender_item_id"],
      {
        name: "tender_vendor_item_quotes_vendor_item_idx",
        unique: true,
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TENDER_VENDOR_ITEM_QUOTE_TABLE);
  },
};
