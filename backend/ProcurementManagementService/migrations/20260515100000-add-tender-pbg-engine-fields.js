"use strict";

const {
  FIRM_TABLE,
  TENDER_TABLE,
  TENDER_VENDOR_ALLOCATION_EXTENSION_TABLE,
  TENDER_VENDOR_TABLE,
  PURCHASE_ORDER_TABLE,
} = require("../src/constants/table-names");

const addColumnIfMissing = async (queryInterface, tableName, columnName, definition) => {
  const table = await queryInterface.describeTable(tableName);
  if (!table[columnName]) await queryInterface.addColumn(tableName, columnName, definition);
};

const removeColumnIfPresent = async (queryInterface, tableName, columnName) => {
  const table = await queryInterface.describeTable(tableName);
  if (table[columnName]) await queryInterface.removeColumn(tableName, columnName);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, TENDER_TABLE, "tender_type", {
      type: Sequelize.STRING(60),
      allowNull: false,
      defaultValue: "open_tender",
    });
    await addColumnIfMissing(queryInterface, TENDER_TABLE, "rate_contract_type", {
      type: Sequelize.STRING(40),
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, TENDER_VENDOR_TABLE, "pbg_basis", {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, TENDER_VENDOR_TABLE, "pbg_percentage", {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, TENDER_VENDOR_TABLE, "pbg_additional_months", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, PURCHASE_ORDER_TABLE, "po_quantity", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, PURCHASE_ORDER_TABLE, "warranty_start_date", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    const tables = await queryInterface.showAllTables();
    if (!tables.includes(TENDER_VENDOR_ALLOCATION_EXTENSION_TABLE)) {
      await queryInterface.createTable(TENDER_VENDOR_ALLOCATION_EXTENSION_TABLE, {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        tender_vendor_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: TENDER_VENDOR_TABLE, key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        tender_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: TENDER_TABLE, key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        firm_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: FIRM_TABLE, key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        extension_basis: { type: Sequelize.STRING(40), allowNull: false },
        extension_quantity: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
        extension_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
        approval_reference: { type: Sequelize.STRING(180), allowNull: true },
        approval_date: { type: Sequelize.DATEONLY, allowNull: true },
        document_path: { type: Sequelize.STRING(500), allowNull: true },
        remarks: { type: Sequelize.TEXT, allowNull: true },
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
        TENDER_VENDOR_ALLOCATION_EXTENSION_TABLE,
        ["tender_vendor_id"],
        { name: "tender_vendor_allocation_extensions_vendor_idx" },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TENDER_VENDOR_ALLOCATION_EXTENSION_TABLE).catch(() => {});
    await removeColumnIfPresent(queryInterface, PURCHASE_ORDER_TABLE, "warranty_start_date");
    await removeColumnIfPresent(queryInterface, PURCHASE_ORDER_TABLE, "po_quantity");
    await removeColumnIfPresent(queryInterface, TENDER_VENDOR_TABLE, "pbg_additional_months");
    await removeColumnIfPresent(queryInterface, TENDER_VENDOR_TABLE, "pbg_percentage");
    await removeColumnIfPresent(queryInterface, TENDER_VENDOR_TABLE, "pbg_basis");
    await removeColumnIfPresent(queryInterface, TENDER_TABLE, "rate_contract_type");
    await removeColumnIfPresent(queryInterface, TENDER_TABLE, "tender_type");
  },
};
