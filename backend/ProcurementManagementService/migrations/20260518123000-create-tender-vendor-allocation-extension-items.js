"use strict";

const {
  TENDER_ITEM_TABLE,
  TENDER_VENDOR_ALLOCATION_EXTENSION_ITEM_TABLE,
  TENDER_VENDOR_ALLOCATION_EXTENSION_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes(TENDER_VENDOR_ALLOCATION_EXTENSION_ITEM_TABLE)) {
      await queryInterface.createTable(
        TENDER_VENDOR_ALLOCATION_EXTENSION_ITEM_TABLE,
        {
          id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
          allocation_extension_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: TENDER_VENDOR_ALLOCATION_EXTENSION_TABLE,
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          tender_item_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: TENDER_ITEM_TABLE,
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          extension_quantity: {
            type: Sequelize.DECIMAL(15, 2),
            allowNull: true,
          },
          extension_amount: {
            type: Sequelize.DECIMAL(15, 2),
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
        },
      );
      await queryInterface.addIndex(
        TENDER_VENDOR_ALLOCATION_EXTENSION_ITEM_TABLE,
        ["allocation_extension_id"],
        {
          name: "tender_vendor_allocation_extension_items_parent_idx",
        },
      );
      await queryInterface.addIndex(
        TENDER_VENDOR_ALLOCATION_EXTENSION_ITEM_TABLE,
        ["tender_item_id"],
        {
          name: "tender_vendor_allocation_extension_items_item_idx",
        },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface
      .dropTable(TENDER_VENDOR_ALLOCATION_EXTENSION_ITEM_TABLE)
      .catch(() => {});
  },
};
