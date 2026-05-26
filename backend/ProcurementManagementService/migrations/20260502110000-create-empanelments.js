"use strict";

const {
  EMPANELMENT_EXTENSION_TABLE,
  EMPANELMENT_ITEM_CATEGORY_TABLE,
  EMPANELMENT_OEM_TABLE,
  EMPANELMENT_TABLE,
  FIRM_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(EMPANELMENT_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      firm_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: FIRM_TABLE, key: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
      empanelment_no: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      valid_from: { type: Sequelize.DATEONLY, allowNull: false },
      valid_upto: { type: Sequelize.DATEONLY, allowNull: false },
      current_valid_upto: { type: Sequelize.DATEONLY, allowNull: false },
      status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "active" },
      approval_reference: { type: Sequelize.STRING(160), allowNull: true },
      approval_date: { type: Sequelize.DATEONLY, allowNull: true },
      document_path: { type: Sequelize.STRING(500), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.STRING(80), allowNull: true },
      updated_by: { type: Sequelize.STRING(80), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable(EMPANELMENT_ITEM_CATEGORY_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      empanelment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: EMPANELMENT_TABLE, key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      category_name: { type: Sequelize.STRING(160), allowNull: false },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable(EMPANELMENT_OEM_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      empanelment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: EMPANELMENT_TABLE, key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      item_category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: EMPANELMENT_ITEM_CATEGORY_TABLE, key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      oem_name: { type: Sequelize.STRING(180), allowNull: false },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable(EMPANELMENT_EXTENSION_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      empanelment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: EMPANELMENT_TABLE, key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      previous_valid_upto: { type: Sequelize.DATEONLY, allowNull: false },
      extended_upto: { type: Sequelize.DATEONLY, allowNull: false },
      approval_reference: { type: Sequelize.STRING(160), allowNull: true },
      approval_date: { type: Sequelize.DATEONLY, allowNull: true },
      approval_document_path: { type: Sequelize.STRING(500), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex(EMPANELMENT_TABLE, ["firm_id"], { name: "empanelments_firm_idx" });
    await queryInterface.addIndex(EMPANELMENT_TABLE, ["status", "current_valid_upto"], {
      name: "empanelments_status_validity_idx",
    });
    await queryInterface.addIndex(EMPANELMENT_ITEM_CATEGORY_TABLE, ["empanelment_id"], {
      name: "empanelment_item_categories_empanelment_idx",
    });
    await queryInterface.addIndex(EMPANELMENT_OEM_TABLE, ["empanelment_id", "item_category_id"], {
      name: "empanelment_oems_empanelment_category_idx",
    });
    await queryInterface.addIndex(EMPANELMENT_EXTENSION_TABLE, ["empanelment_id", "extended_upto"], {
      name: "empanelment_extensions_empanelment_date_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(EMPANELMENT_EXTENSION_TABLE);
    await queryInterface.dropTable(EMPANELMENT_OEM_TABLE);
    await queryInterface.dropTable(EMPANELMENT_ITEM_CATEGORY_TABLE);
    await queryInterface.dropTable(EMPANELMENT_TABLE);
  },
};
