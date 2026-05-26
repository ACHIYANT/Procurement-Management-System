"use strict";

const {
  INDENT_ITEM_TABLE,
  ITEM_CATEGORY_TABLE,
  ITEM_SUBCATEGORY_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(ITEM_CATEGORY_TABLE, {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      category_name: { type: Sequelize.STRING(160), allowNull: false, unique: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable(ITEM_SUBCATEGORY_TABLE, {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: ITEM_CATEGORY_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      subcategory_name: { type: Sequelize.STRING(160), allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex(ITEM_SUBCATEGORY_TABLE, ["category_id", "subcategory_name"], {
      name: "item_subcategories_category_name_unique",
      unique: true,
    });

    await queryInterface.addColumn(INDENT_ITEM_TABLE, "category_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: ITEM_CATEGORY_TABLE, key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn(INDENT_ITEM_TABLE, "subcategory_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: ITEM_SUBCATEGORY_TABLE, key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(INDENT_ITEM_TABLE, "subcategory_id").catch(() => {});
    await queryInterface.removeColumn(INDENT_ITEM_TABLE, "category_id").catch(() => {});
    await queryInterface.dropTable(ITEM_SUBCATEGORY_TABLE).catch(() => {});
    await queryInterface.dropTable(ITEM_CATEGORY_TABLE).catch(() => {});
  },
};
