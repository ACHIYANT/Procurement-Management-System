"use strict";

const { Model } = require("sequelize");
const { APPROVAL_WORKFLOW_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class ApprovalWorkflow extends Model {
    static associate(models) {
      ApprovalWorkflow.hasMany(models.ApprovalWorkflowLevel, {
        foreignKey: "approval_workflow_id",
        as: "levels",
      });
      ApprovalWorkflow.hasMany(models.ApprovalRequest, {
        foreignKey: "approval_workflow_id",
        as: "requests",
      });
      ApprovalWorkflow.belongsTo(models.ProcurementEmployee, {
        foreignKey: "created_by_employee_id",
        as: "created_by_employee",
      });
    }
  }

  ApprovalWorkflow.init(
    {
      module_key: { type: DataTypes.STRING(80), allowNull: false },
      action_key: { type: DataTypes.STRING(120), allowNull: false },
      workflow_name: { type: DataTypes.STRING(180), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_by_employee_id: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      sequelize,
      modelName: "ApprovalWorkflow",
      tableName: APPROVAL_WORKFLOW_TABLE,
      underscored: true,
    },
  );

  return ApprovalWorkflow;
};
