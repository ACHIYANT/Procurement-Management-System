"use strict";

const {
  PURCHASE_ORDER_TABLE,
  PURCHASE_ORDER_ITEM_TABLE,
  PURCHASE_ORDER_CONSIGNEE_TABLE,
  PURCHASE_ORDER_INSPECTION_TABLE,
  PURCHASE_ORDER_INSPECTION_ITEM_TABLE,
  PURCHASE_ORDER_DELIVERY_BATCH_TABLE,
  PURCHASE_ORDER_DELIVERY_ITEM_TABLE,
  PURCHASE_ORDER_INSTALLATION_BATCH_TABLE,
  PURCHASE_ORDER_INSTALLATION_ITEM_TABLE,
  TENDER_ITEM_TABLE,
  INDENT_ITEM_TABLE,
} = require("../src/constants/table-names");

const fk = (table, key = "id") => ({
  type: "INTEGER",
  references: { model: table, key },
  onUpdate: "CASCADE",
  onDelete: "CASCADE",
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(PURCHASE_ORDER_ITEM_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      purchase_order_id: { ...fk(PURCHASE_ORDER_TABLE), allowNull: false },
      tender_item_id: { ...fk(TENDER_ITEM_TABLE), allowNull: true },
      indent_item_id: { ...fk(INDENT_ITEM_TABLE), allowNull: true },
      item_name: { type: Sequelize.STRING(255), allowNull: false },
      item_description: { type: Sequelize.TEXT, allowNull: true },
      make: { type: Sequelize.STRING(150), allowNull: true },
      model: { type: Sequelize.STRING(150), allowNull: true },
      quantity: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      unit: { type: Sequelize.STRING(40), allowNull: true },
      unit_rate: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      gst_percentage: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      installation_required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      installation_mode: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "normal" },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable(PURCHASE_ORDER_CONSIGNEE_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      purchase_order_id: { ...fk(PURCHASE_ORDER_TABLE), allowNull: false },
      consignee_name: { type: Sequelize.STRING(255), allowNull: false },
      consignee_address: { type: Sequelize.TEXT, allowNull: false },
      contact_no: { type: Sequelize.STRING(40), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable(PURCHASE_ORDER_INSPECTION_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      purchase_order_id: { ...fk(PURCHASE_ORDER_TABLE), allowNull: false },
      inspection_date: { type: Sequelize.DATEONLY, allowNull: false },
      inspection_note_path: { type: Sequelize.STRING(500), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable(PURCHASE_ORDER_INSPECTION_ITEM_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      inspection_id: { ...fk(PURCHASE_ORDER_INSPECTION_TABLE), allowNull: false },
      purchase_order_item_id: { ...fk(PURCHASE_ORDER_ITEM_TABLE), allowNull: false },
      offered_quantity: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      accepted_quantity: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable(PURCHASE_ORDER_DELIVERY_BATCH_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      purchase_order_id: { ...fk(PURCHASE_ORDER_TABLE), allowNull: false },
      delivery_challan_no: { type: Sequelize.STRING(100), allowNull: true },
      delivery_challan_date: { type: Sequelize.DATEONLY, allowNull: true },
      seller_invoice_no: { type: Sequelize.STRING(100), allowNull: true },
      seller_invoice_date: { type: Sequelize.DATEONLY, allowNull: true },
      delivery_document_path: { type: Sequelize.STRING(500), allowNull: true },
      invoice_document_path: { type: Sequelize.STRING(500), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable(PURCHASE_ORDER_DELIVERY_ITEM_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      delivery_batch_id: { ...fk(PURCHASE_ORDER_DELIVERY_BATCH_TABLE), allowNull: false },
      purchase_order_item_id: { ...fk(PURCHASE_ORDER_ITEM_TABLE), allowNull: false },
      consignee_id: { ...fk(PURCHASE_ORDER_CONSIGNEE_TABLE), allowNull: false },
      delivered_quantity: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable(PURCHASE_ORDER_INSTALLATION_BATCH_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      purchase_order_id: { ...fk(PURCHASE_ORDER_TABLE), allowNull: false },
      installation_type: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "normal" },
      report_path: { type: Sequelize.STRING(500), allowNull: true },
      noc_path: { type: Sequelize.STRING(500), allowNull: true },
      declaration_path: { type: Sequelize.STRING(500), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable(PURCHASE_ORDER_INSTALLATION_ITEM_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      installation_batch_id: { ...fk(PURCHASE_ORDER_INSTALLATION_BATCH_TABLE), allowNull: false },
      purchase_order_item_id: { ...fk(PURCHASE_ORDER_ITEM_TABLE), allowNull: false },
      consignee_id: { ...fk(PURCHASE_ORDER_CONSIGNEE_TABLE), allowNull: false },
      installed_quantity: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      installation_completion_date: { type: Sequelize.DATEONLY, allowNull: false },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(PURCHASE_ORDER_INSTALLATION_ITEM_TABLE);
    await queryInterface.dropTable(PURCHASE_ORDER_INSTALLATION_BATCH_TABLE);
    await queryInterface.dropTable(PURCHASE_ORDER_DELIVERY_ITEM_TABLE);
    await queryInterface.dropTable(PURCHASE_ORDER_DELIVERY_BATCH_TABLE);
    await queryInterface.dropTable(PURCHASE_ORDER_INSPECTION_ITEM_TABLE);
    await queryInterface.dropTable(PURCHASE_ORDER_INSPECTION_TABLE);
    await queryInterface.dropTable(PURCHASE_ORDER_CONSIGNEE_TABLE);
    await queryInterface.dropTable(PURCHASE_ORDER_ITEM_TABLE);
  },
};
