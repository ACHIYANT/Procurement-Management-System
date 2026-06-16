"use strict";

const { Model } = require("sequelize");
const { WORK_TASK_ASSIGNEE_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class WorkTaskAssignee extends Model {
    static associate(models) {
      WorkTaskAssignee.belongsTo(models.WorkTask, {
        foreignKey: "work_task_id",
        as: "task",
      });
      WorkTaskAssignee.belongsTo(models.ProcurementEmployee, {
        foreignKey: "assigned_to_employee_id",
        as: "assigned_to_employee",
      });
    }
  }

  WorkTaskAssignee.init(
    {
      work_task_id: { type: DataTypes.INTEGER, allowNull: false },
      assigned_to_employee_id: { type: DataTypes.INTEGER, allowNull: true },
      assigned_to_name: { type: DataTypes.STRING(160), allowNull: true },
      status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "open" },
      accepted_at: { type: DataTypes.DATE, allowNull: true },
      completed_at: { type: DataTypes.DATE, allowNull: true },
      returned_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: "WorkTaskAssignee",
      tableName: WORK_TASK_ASSIGNEE_TABLE,
      underscored: true,
    },
  );

  return WorkTaskAssignee;
};
