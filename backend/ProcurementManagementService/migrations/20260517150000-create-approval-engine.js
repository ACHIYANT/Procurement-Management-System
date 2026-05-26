"use strict";

const {
  APPROVAL_WORKFLOW_TABLE,
  APPROVAL_WORKFLOW_LEVEL_TABLE,
  APPROVAL_REQUEST_TABLE,
  APPROVAL_REQUEST_STEP_TABLE,
  APPROVAL_REQUEST_PAYLOAD_TABLE,
  PROCUREMENT_EMPLOYEE_TABLE,
} = require("../src/constants/table-names");

const timestampColumns = (Sequelize) => ({
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

const employeeFk = (Sequelize, allowNull = true) => ({
  type: Sequelize.INTEGER,
  allowNull,
  references: { model: PROCUREMENT_EMPLOYEE_TABLE, key: "id" },
  onUpdate: "CASCADE",
  onDelete: "SET NULL",
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(APPROVAL_WORKFLOW_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      module_key: { type: Sequelize.STRING(80), allowNull: false },
      action_key: { type: Sequelize.STRING(120), allowNull: false },
      workflow_name: { type: Sequelize.STRING(180), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by_employee_id: employeeFk(Sequelize),
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex(APPROVAL_WORKFLOW_TABLE, ["module_key", "action_key", "is_active"], {
      name: "approval_workflows_module_action_active_idx",
    });

    await queryInterface.createTable(APPROVAL_WORKFLOW_LEVEL_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      approval_workflow_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: APPROVAL_WORKFLOW_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      level_no: { type: Sequelize.INTEGER, allowNull: false },
      level_name: { type: Sequelize.STRING(160), allowNull: false },
      approver_type: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "role" },
      approver_role: { type: Sequelize.STRING(80), allowNull: true },
      approver_employee_id: employeeFk(Sequelize),
      min_required_approvals: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      is_final_level: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex(APPROVAL_WORKFLOW_LEVEL_TABLE, ["approval_workflow_id", "level_no"], {
      name: "approval_workflow_levels_order_idx",
      unique: true,
    });

    await queryInterface.createTable(APPROVAL_REQUEST_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      approval_workflow_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: APPROVAL_WORKFLOW_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      module_key: { type: Sequelize.STRING(80), allowNull: false },
      action_key: { type: Sequelize.STRING(120), allowNull: false },
      entity_type: { type: Sequelize.STRING(100), allowNull: false },
      entity_id: { type: Sequelize.STRING(80), allowNull: false },
      request_title: { type: Sequelize.STRING(220), allowNull: false },
      request_reason: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "pending" },
      current_level_no: { type: Sequelize.INTEGER, allowNull: true },
      requested_by_employee_id: employeeFk(Sequelize),
      requested_by_name: { type: Sequelize.STRING(160), allowNull: true },
      applied_at: { type: Sequelize.DATE, allowNull: true },
      rejected_at: { type: Sequelize.DATE, allowNull: true },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex(APPROVAL_REQUEST_TABLE, ["module_key", "action_key", "status"], {
      name: "approval_requests_module_action_status_idx",
    });
    await queryInterface.addIndex(APPROVAL_REQUEST_TABLE, ["entity_type", "entity_id"], {
      name: "approval_requests_entity_idx",
    });

    await queryInterface.createTable(APPROVAL_REQUEST_STEP_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      approval_request_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: APPROVAL_REQUEST_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      level_no: { type: Sequelize.INTEGER, allowNull: false },
      level_name: { type: Sequelize.STRING(160), allowNull: false },
      approver_type: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "role" },
      approver_role: { type: Sequelize.STRING(80), allowNull: true },
      approver_employee_id: employeeFk(Sequelize),
      min_required_approvals: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "pending" },
      approved_by_employee_id: employeeFk(Sequelize),
      approved_by_name: { type: Sequelize.STRING(160), allowNull: true },
      approved_at: { type: Sequelize.DATE, allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex(APPROVAL_REQUEST_STEP_TABLE, ["approval_request_id", "level_no"], {
      name: "approval_request_steps_order_idx",
      unique: true,
    });

    await queryInterface.createTable(APPROVAL_REQUEST_PAYLOAD_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      approval_request_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: APPROVAL_REQUEST_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      old_payload: { type: Sequelize.TEXT("long"), allowNull: true },
      proposed_payload: { type: Sequelize.TEXT("long"), allowNull: false },
      applied_payload: { type: Sequelize.TEXT("long"), allowNull: true },
      ...timestampColumns(Sequelize),
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(APPROVAL_REQUEST_PAYLOAD_TABLE);
    await queryInterface.dropTable(APPROVAL_REQUEST_STEP_TABLE);
    await queryInterface.dropTable(APPROVAL_REQUEST_TABLE);
    await queryInterface.dropTable(APPROVAL_WORKFLOW_LEVEL_TABLE);
    await queryInterface.dropTable(APPROVAL_WORKFLOW_TABLE);
  },
};
