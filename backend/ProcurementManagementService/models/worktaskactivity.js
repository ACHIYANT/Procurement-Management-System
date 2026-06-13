"use strict";

const { Model } = require("sequelize");
const { WORK_TASK_ACTIVITY_TABLE } = require("../src/constants/table-names");

const parseJsonObject = (value) => {
  if (!value) return {};
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

module.exports = (sequelize, DataTypes) => {
  class WorkTaskActivity extends Model {
    static associate(models) {
      WorkTaskActivity.belongsTo(models.WorkTask, {
        foreignKey: "work_task_id",
        as: "task",
      });
      WorkTaskActivity.belongsTo(models.ProcurementEmployee, {
        foreignKey: "actor_employee_id",
        as: "actor_employee",
      });
    }
  }

  WorkTaskActivity.init(
    {
      work_task_id: { type: DataTypes.INTEGER, allowNull: false },
      action_type: { type: DataTypes.STRING(60), allowNull: false },
      from_status: { type: DataTypes.STRING(40), allowNull: true },
      to_status: { type: DataTypes.STRING(40), allowNull: true },
      remarks: { type: DataTypes.TEXT, allowNull: true },
      metadata_json: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          return parseJsonObject(this.getDataValue("metadata_json"));
        },
        set(value) {
          this.setDataValue("metadata_json", JSON.stringify(value && typeof value === "object" ? value : {}));
        },
      },
      actor_employee_id: { type: DataTypes.INTEGER, allowNull: true },
      actor_name: { type: DataTypes.STRING(160), allowNull: true },
    },
    {
      sequelize,
      modelName: "WorkTaskActivity",
      tableName: WORK_TASK_ACTIVITY_TABLE,
      underscored: true,
    },
  );

  return WorkTaskActivity;
};
