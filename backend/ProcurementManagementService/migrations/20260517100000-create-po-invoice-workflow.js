"use strict";

const {
  PURCHASE_ORDER_TABLE,
  PURCHASE_ORDER_ITEM_TABLE,
  PURCHASE_ORDER_CONSIGNEE_TABLE,
  FIRM_TABLE,
  SELLER_INVOICE_TABLE,
  SELLER_INVOICE_ITEM_TABLE,
  PURCHASE_INVOICE_TABLE,
  SALE_INVOICE_TABLE,
  SALE_INVOICE_ITEM_TABLE,
} = require("../src/constants/table-names");

const fk = (table, onDelete = "CASCADE") => ({
  type: "INTEGER",
  references: { model: table, key: "id" },
  onUpdate: "CASCADE",
  onDelete,
});

const money = (Sequelize, defaultValue = 0) => ({
  type: Sequelize.DECIMAL(15, 2),
  allowNull: false,
  defaultValue,
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(SELLER_INVOICE_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      purchase_order_id: { ...fk(PURCHASE_ORDER_TABLE), allowNull: false },
      firm_id: { ...fk(FIRM_TABLE, "RESTRICT"), allowNull: false },
      consignee_id: { ...fk(PURCHASE_ORDER_CONSIGNEE_TABLE, "SET NULL"), allowNull: true },
      seller_invoice_no: { type: Sequelize.STRING(100), allowNull: false },
      seller_invoice_date: { type: Sequelize.DATEONLY, allowNull: false },
      bill_from: { type: Sequelize.TEXT, allowNull: true },
      ship_to: { type: Sequelize.TEXT, allowNull: true },
      invoice_document_path: { type: Sequelize.STRING(500), allowNull: true },
      taxable_amount: money(Sequelize),
      gst_amount: money(Sequelize),
      grand_total: money(Sequelize),
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable(SELLER_INVOICE_ITEM_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      seller_invoice_id: { ...fk(SELLER_INVOICE_TABLE), allowNull: false },
      purchase_order_item_id: { ...fk(PURCHASE_ORDER_ITEM_TABLE), allowNull: false },
      consignee_id: { ...fk(PURCHASE_ORDER_CONSIGNEE_TABLE, "SET NULL"), allowNull: true },
      quantity: money(Sequelize),
      unit_rate: money(Sequelize),
      gst_percentage: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      taxable_amount: money(Sequelize),
      gst_amount: money(Sequelize),
      total_amount: money(Sequelize),
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable(PURCHASE_INVOICE_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      purchase_order_id: { ...fk(PURCHASE_ORDER_TABLE), allowNull: false },
      seller_invoice_id: { ...fk(SELLER_INVOICE_TABLE), allowNull: false },
      voucher_no: { type: Sequelize.STRING(100), allowNull: false },
      voucher_date: { type: Sequelize.DATEONLY, allowNull: false },
      tds_amount: money(Sequelize),
      round_off: money(Sequelize),
      gross_amount: money(Sequelize),
      grand_total: money(Sequelize),
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable(SALE_INVOICE_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      purchase_order_id: { ...fk(PURCHASE_ORDER_TABLE), allowNull: false },
      sale_invoice_no: { type: Sequelize.STRING(100), allowNull: false },
      sale_invoice_date: { type: Sequelize.DATEONLY, allowNull: false },
      billing_mode: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "consolidated" },
      bill_to: { type: Sequelize.TEXT, allowNull: false },
      ship_to: { type: Sequelize.TEXT, allowNull: true },
      consultancy_charge_type: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "percentage" },
      consultancy_percentage: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      consultancy_flat_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      taxable_amount: money(Sequelize),
      gst_amount: money(Sequelize),
      round_off: money(Sequelize),
      grand_total: money(Sequelize),
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable(SALE_INVOICE_ITEM_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      sale_invoice_id: { ...fk(SALE_INVOICE_TABLE), allowNull: false },
      purchase_order_item_id: { ...fk(PURCHASE_ORDER_ITEM_TABLE), allowNull: false },
      consignee_id: { ...fk(PURCHASE_ORDER_CONSIGNEE_TABLE, "SET NULL"), allowNull: true },
      quantity: money(Sequelize),
      base_unit_rate: money(Sequelize),
      consultancy_amount: money(Sequelize),
      final_unit_rate: money(Sequelize),
      gst_percentage: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      taxable_amount: money(Sequelize),
      gst_amount: money(Sequelize),
      total_amount: money(Sequelize),
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(SALE_INVOICE_ITEM_TABLE);
    await queryInterface.dropTable(SALE_INVOICE_TABLE);
    await queryInterface.dropTable(PURCHASE_INVOICE_TABLE);
    await queryInterface.dropTable(SELLER_INVOICE_ITEM_TABLE);
    await queryInterface.dropTable(SELLER_INVOICE_TABLE);
  },
};
