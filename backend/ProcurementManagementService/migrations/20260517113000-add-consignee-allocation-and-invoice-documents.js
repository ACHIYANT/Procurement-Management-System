"use strict";

const {
  PURCHASE_ORDER_CONSIGNEE_TABLE,
  PURCHASE_ORDER_CONSIGNEE_ITEM_TABLE,
  PURCHASE_ORDER_ITEM_TABLE,
  PURCHASE_INVOICE_TABLE,
  SALE_INVOICE_TABLE,
} = require("../src/constants/table-names");

const addColumnIfMissing = async (queryInterface, tableName, columnName, definition) => {
  const table = await queryInterface.describeTable(tableName);
  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
};

const removeColumnIfPresent = async (queryInterface, tableName, columnName) => {
  const table = await queryInterface.describeTable(tableName);
  if (table[columnName]) {
    await queryInterface.removeColumn(tableName, columnName);
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes(PURCHASE_ORDER_CONSIGNEE_ITEM_TABLE)) {
      await queryInterface.createTable(PURCHASE_ORDER_CONSIGNEE_ITEM_TABLE, {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        consignee_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: PURCHASE_ORDER_CONSIGNEE_TABLE, key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        purchase_order_item_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: PURCHASE_ORDER_ITEM_TABLE, key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        allocated_quantity: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        remarks: { type: Sequelize.TEXT, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      });
    }

    await addColumnIfMissing(queryInterface, PURCHASE_INVOICE_TABLE, "bill_document_path", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, SALE_INVOICE_TABLE, "invoice_document_path", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await removeColumnIfPresent(queryInterface, SALE_INVOICE_TABLE, "invoice_document_path");
    await removeColumnIfPresent(queryInterface, PURCHASE_INVOICE_TABLE, "bill_document_path");
    await queryInterface.dropTable(PURCHASE_ORDER_CONSIGNEE_ITEM_TABLE);
  },
};
