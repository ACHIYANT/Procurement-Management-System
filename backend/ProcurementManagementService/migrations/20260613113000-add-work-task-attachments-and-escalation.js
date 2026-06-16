"use strict";

const {
  PROCUREMENT_EMPLOYEE_TABLE,
  WORK_TASK_TABLE,
  WORK_TASK_ATTACHMENT_TABLE,
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

const employeeFk = (Sequelize) => ({
  type: Sequelize.INTEGER,
  allowNull: true,
  references: { model: PROCUREMENT_EMPLOYEE_TABLE, key: "id" },
  onUpdate: "CASCADE",
  onDelete: "SET NULL",
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(WORK_TASK_TABLE, "escalation_status", {
      type: Sequelize.STRING(40),
      allowNull: false,
      defaultValue: "none",
    });
    await queryInterface.addColumn(WORK_TASK_TABLE, "escalated_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn(WORK_TASK_TABLE, "escalated_to_employee_id", employeeFk(Sequelize));
    await queryInterface.addColumn(WORK_TASK_TABLE, "escalated_to_name", {
      type: Sequelize.STRING(160),
      allowNull: true,
    });
    await queryInterface.addColumn(WORK_TASK_TABLE, "escalation_reason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addIndex(WORK_TASK_TABLE, ["escalation_status", "due_at"], {
      name: "work_tasks_escalation_due_idx",
    });

    await queryInterface.createTable(WORK_TASK_ATTACHMENT_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      work_task_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: WORK_TASK_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      document_path: { type: Sequelize.STRING(500), allowNull: false },
      original_file_name: { type: Sequelize.STRING(260), allowNull: true },
      file_size: { type: Sequelize.INTEGER, allowNull: true },
      mime_type: { type: Sequelize.STRING(120), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      uploaded_by_employee_id: employeeFk(Sequelize),
      uploaded_by_name: { type: Sequelize.STRING(160), allowNull: true },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex(WORK_TASK_ATTACHMENT_TABLE, ["work_task_id", "created_at"], {
      name: "work_task_attachments_task_created_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(WORK_TASK_ATTACHMENT_TABLE);
    await queryInterface.removeIndex(WORK_TASK_TABLE, "work_tasks_escalation_due_idx");
    await queryInterface.removeColumn(WORK_TASK_TABLE, "escalation_reason");
    await queryInterface.removeColumn(WORK_TASK_TABLE, "escalated_to_name");
    await queryInterface.removeColumn(WORK_TASK_TABLE, "escalated_to_employee_id");
    await queryInterface.removeColumn(WORK_TASK_TABLE, "escalated_at");
    await queryInterface.removeColumn(WORK_TASK_TABLE, "escalation_status");
  },
};
