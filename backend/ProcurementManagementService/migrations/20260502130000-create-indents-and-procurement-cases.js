"use strict";

const {
  INDENT_TABLE,
  INDENT_ITEM_TABLE,
  PROCUREMENT_CASE_TABLE,
  PROCUREMENT_CASE_ITEM_TABLE,
  PROCUREMENT_EMPLOYEE_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(INDENT_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      indent_no: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      indent_date: { type: Sequelize.DATEONLY, allowNull: false },
      department_name: { type: Sequelize.STRING(160), allowNull: false },
      requested_by_name: { type: Sequelize.STRING(160), allowNull: false },
      requested_by_empcode: { type: Sequelize.STRING(80), allowNull: true },
      justification: { type: Sequelize.TEXT, allowNull: true },
      estimated_value: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      specification_notes: { type: Sequelize.TEXT, allowNull: true },
      approval_status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "pending" },
      approval_date: { type: Sequelize.DATEONLY, allowNull: true },
      status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "open" },
      location_scope: { type: Sequelize.STRING(80), allowNull: false, defaultValue: "PANCHKULA" },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable(INDENT_ITEM_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      indent_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: INDENT_TABLE, key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      item_name: { type: Sequelize.STRING(180), allowNull: false },
      quantity: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      unit: { type: Sequelize.STRING(40), allowNull: false },
      specification: { type: Sequelize.TEXT, allowNull: false },
      estimated_rate: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      estimated_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      brand_preference: { type: Sequelize.STRING(160), allowNull: true },
      assigned_procurement_officer_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: PROCUREMENT_EMPLOYEE_TABLE, key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      assignment_status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "unassigned" },
      procurement_decision_status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "pending" },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable(PROCUREMENT_CASE_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      indent_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: INDENT_TABLE, key: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
      case_no: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      title: { type: Sequelize.STRING(220), allowNull: false },
      procurement_officer_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: PROCUREMENT_EMPLOYEE_TABLE, key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      procurement_mode: { type: Sequelize.STRING(60), allowNull: false },
      estimated_value: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "draft" },
      location_scope: { type: Sequelize.STRING(80), allowNull: false, defaultValue: "PANCHKULA" },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable(PROCUREMENT_CASE_ITEM_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      procurement_case_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: PROCUREMENT_CASE_TABLE, key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      indent_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: INDENT_ITEM_TABLE, key: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex(INDENT_TABLE, ["indent_date", "department_name"], {
      name: "indents_date_department_idx",
    });
    await queryInterface.addIndex(INDENT_TABLE, ["status", "location_scope"], {
      name: "indents_status_location_idx",
    });
    await queryInterface.addIndex(INDENT_ITEM_TABLE, ["indent_id"], {
      name: "indent_items_indent_idx",
    });
    await queryInterface.addIndex(INDENT_ITEM_TABLE, ["assigned_procurement_officer_id", "assignment_status"], {
      name: "indent_items_procurement_officer_assignment_idx",
    });
    await queryInterface.addIndex(PROCUREMENT_CASE_TABLE, ["indent_id", "procurement_mode"], {
      name: "procurement_cases_indent_mode_idx",
    });
    await queryInterface.addIndex(PROCUREMENT_CASE_TABLE, ["procurement_officer_id", "status"], {
      name: "procurement_cases_procurement_officer_status_idx",
    });
    await queryInterface.addIndex(PROCUREMENT_CASE_ITEM_TABLE, ["procurement_case_id"], {
      name: "procurement_case_items_case_idx",
    });
    await queryInterface.addIndex(PROCUREMENT_CASE_ITEM_TABLE, ["indent_item_id"], {
      name: "procurement_case_items_indent_item_idx",
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(PROCUREMENT_CASE_ITEM_TABLE);
    await queryInterface.dropTable(PROCUREMENT_CASE_TABLE);
    await queryInterface.dropTable(INDENT_ITEM_TABLE);
    await queryInterface.dropTable(INDENT_TABLE);
  },
};
