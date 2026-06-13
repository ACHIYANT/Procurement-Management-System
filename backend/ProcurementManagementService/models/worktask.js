"use strict";

const { Model } = require("sequelize");
const { WORK_TASK_TABLE } = require("../src/constants/table-names");

const parseJsonArray = (value) => {
  if (!value) return [];
  try {
    const parsed = Array.isArray(value) ? value : JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

module.exports = (sequelize, DataTypes) => {
  class WorkTask extends Model {
    static associate(models) {
      WorkTask.belongsTo(models.ProcurementEmployee, {
        foreignKey: "created_by_employee_id",
        as: "created_by_employee",
      });
      WorkTask.belongsTo(models.ProcurementEmployee, {
        foreignKey: "assigned_by_employee_id",
        as: "assigned_by_employee",
      });
      WorkTask.belongsTo(models.ProcurementEmployee, {
        foreignKey: "completed_by_employee_id",
        as: "completed_by_employee",
      });
      WorkTask.belongsTo(models.ProcurementEmployee, {
        foreignKey: "returned_by_employee_id",
        as: "returned_by_employee",
      });
      WorkTask.hasMany(models.WorkTaskAssignee, {
        foreignKey: "work_task_id",
        as: "assignees",
      });
      WorkTask.hasMany(models.WorkTaskComment, {
        foreignKey: "work_task_id",
        as: "comments",
      });
      WorkTask.hasMany(models.WorkTaskActivity, {
        foreignKey: "work_task_id",
        as: "activities",
      });
    }
  }

  WorkTask.init(
    {
      title: { type: DataTypes.STRING(220), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "open" },
      priority: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "medium" },
      severity: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "normal" },
      origin_type: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "self" },
      origin_label: { type: DataTypes.STRING(160), allowNull: true },
      system_rule_code: { type: DataTypes.STRING(120), allowNull: true },
      module_key: { type: DataTypes.STRING(80), allowNull: true },
      entity_type: { type: DataTypes.STRING(100), allowNull: true },
      entity_id: { type: DataTypes.STRING(80), allowNull: true },
      linked_reference: { type: DataTypes.STRING(220), allowNull: true },
      linked_url: { type: DataTypes.STRING(260), allowNull: true },
      due_at: { type: DataTypes.DATE, allowNull: true },
      reminder_at: { type: DataTypes.DATE, allowNull: true },
      reminder_sound: { type: DataTypes.STRING(60), allowNull: false, defaultValue: "soft_bell" },
      repeat_rule: { type: DataTypes.STRING(80), allowNull: true },
      tags_json: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          return parseJsonArray(this.getDataValue("tags_json"));
        },
        set(value) {
          this.setDataValue("tags_json", JSON.stringify(Array.isArray(value) ? value : []));
        },
      },
      checklist_json: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          return parseJsonArray(this.getDataValue("checklist_json"));
        },
        set(value) {
          this.setDataValue("checklist_json", JSON.stringify(Array.isArray(value) ? value : []));
        },
      },
      created_by_employee_id: { type: DataTypes.INTEGER, allowNull: true },
      created_by_name: { type: DataTypes.STRING(160), allowNull: true },
      assigned_by_employee_id: { type: DataTypes.INTEGER, allowNull: true },
      assigned_by_name: { type: DataTypes.STRING(160), allowNull: true },
      completed_at: { type: DataTypes.DATE, allowNull: true },
      completed_by_employee_id: { type: DataTypes.INTEGER, allowNull: true },
      returned_at: { type: DataTypes.DATE, allowNull: true },
      returned_by_employee_id: { type: DataTypes.INTEGER, allowNull: true },
      return_reason: { type: DataTypes.STRING(120), allowNull: true },
      return_remarks: { type: DataTypes.TEXT, allowNull: true },
      last_activity_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: "WorkTask",
      tableName: WORK_TASK_TABLE,
      underscored: true,
    },
  );

  return WorkTask;
};
