"use strict";

const {
  PROCUREMENT_EMPLOYEE_TABLE,
  WORK_TASK_TABLE,
  WORK_TASK_ASSIGNEE_TABLE,
  WORK_TASK_COMMENT_TABLE,
  WORK_TASK_ACTIVITY_TABLE,
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
    await queryInterface.createTable(WORK_TASK_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: Sequelize.STRING(220), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "open" },
      priority: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "medium" },
      severity: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "normal" },
      origin_type: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "self" },
      origin_label: { type: Sequelize.STRING(160), allowNull: true },
      system_rule_code: { type: Sequelize.STRING(120), allowNull: true },
      module_key: { type: Sequelize.STRING(80), allowNull: true },
      entity_type: { type: Sequelize.STRING(100), allowNull: true },
      entity_id: { type: Sequelize.STRING(80), allowNull: true },
      linked_reference: { type: Sequelize.STRING(220), allowNull: true },
      linked_url: { type: Sequelize.STRING(260), allowNull: true },
      due_at: { type: Sequelize.DATE, allowNull: true },
      reminder_at: { type: Sequelize.DATE, allowNull: true },
      reminder_sound: { type: Sequelize.STRING(60), allowNull: false, defaultValue: "soft_bell" },
      repeat_rule: { type: Sequelize.STRING(80), allowNull: true },
      tags_json: { type: Sequelize.TEXT, allowNull: true },
      checklist_json: { type: Sequelize.TEXT, allowNull: true },
      created_by_employee_id: employeeFk(Sequelize),
      created_by_name: { type: Sequelize.STRING(160), allowNull: true },
      assigned_by_employee_id: employeeFk(Sequelize),
      assigned_by_name: { type: Sequelize.STRING(160), allowNull: true },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      completed_by_employee_id: employeeFk(Sequelize),
      returned_at: { type: Sequelize.DATE, allowNull: true },
      returned_by_employee_id: employeeFk(Sequelize),
      return_reason: { type: Sequelize.STRING(120), allowNull: true },
      return_remarks: { type: Sequelize.TEXT, allowNull: true },
      last_activity_at: { type: Sequelize.DATE, allowNull: true },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex(WORK_TASK_TABLE, ["status", "due_at"], {
      name: "work_tasks_status_due_idx",
    });
    await queryInterface.addIndex(WORK_TASK_TABLE, ["origin_type", "status"], {
      name: "work_tasks_origin_status_idx",
    });
    await queryInterface.addIndex(WORK_TASK_TABLE, ["module_key", "entity_type", "entity_id"], {
      name: "work_tasks_linked_entity_idx",
    });

    await queryInterface.createTable(WORK_TASK_ASSIGNEE_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      work_task_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: WORK_TASK_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      assigned_to_employee_id: employeeFk(Sequelize),
      assigned_to_name: { type: Sequelize.STRING(160), allowNull: true },
      status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "open" },
      accepted_at: { type: Sequelize.DATE, allowNull: true },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      returned_at: { type: Sequelize.DATE, allowNull: true },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex(WORK_TASK_ASSIGNEE_TABLE, ["assigned_to_employee_id", "status"], {
      name: "work_task_assignees_employee_status_idx",
    });
    await queryInterface.addIndex(WORK_TASK_ASSIGNEE_TABLE, ["work_task_id", "assigned_to_employee_id"], {
      name: "work_task_assignees_task_employee_idx",
    });

    await queryInterface.createTable(WORK_TASK_COMMENT_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      work_task_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: WORK_TASK_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      comment_type: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "comment" },
      comment_text: { type: Sequelize.TEXT, allowNull: false },
      author_employee_id: employeeFk(Sequelize),
      author_name: { type: Sequelize.STRING(160), allowNull: true },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex(WORK_TASK_COMMENT_TABLE, ["work_task_id", "created_at"], {
      name: "work_task_comments_task_created_idx",
    });

    await queryInterface.createTable(WORK_TASK_ACTIVITY_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      work_task_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: WORK_TASK_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      action_type: { type: Sequelize.STRING(60), allowNull: false },
      from_status: { type: Sequelize.STRING(40), allowNull: true },
      to_status: { type: Sequelize.STRING(40), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      metadata_json: { type: Sequelize.TEXT, allowNull: true },
      actor_employee_id: employeeFk(Sequelize),
      actor_name: { type: Sequelize.STRING(160), allowNull: true },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex(WORK_TASK_ACTIVITY_TABLE, ["work_task_id", "created_at"], {
      name: "work_task_activities_task_created_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(WORK_TASK_ACTIVITY_TABLE);
    await queryInterface.dropTable(WORK_TASK_COMMENT_TABLE);
    await queryInterface.dropTable(WORK_TASK_ASSIGNEE_TABLE);
    await queryInterface.dropTable(WORK_TASK_TABLE);
  },
};
