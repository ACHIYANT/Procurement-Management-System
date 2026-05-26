"use strict";

const { Model } = require("sequelize");
const { APPROVAL_WORKFLOW_LEVEL_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class ApprovalWorkflowLevel extends Model {
    static associate(models) {
      ApprovalWorkflowLevel.belongsTo(models.ApprovalWorkflow, {
        foreignKey: "approval_workflow_id",
        as: "workflow",
      });
      ApprovalWorkflowLevel.belongsTo(models.ProcurementEmployee, {
        foreignKey: "approver_employee_id",
        as: "approver_employee",
      });
    }
  }

  ApprovalWorkflowLevel.init(
    {
      approval_workflow_id: { type: DataTypes.INTEGER, allowNull: false },
      level_no: { type: DataTypes.INTEGER, allowNull: false },
      level_name: { type: DataTypes.STRING(160), allowNull: false },
      approver_type: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "role" },
      approver_role: { type: DataTypes.STRING(80), allowNull: true },
      approver_employee_id: { type: DataTypes.INTEGER, allowNull: true },
      min_required_approvals: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      is_final_level: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      sequelize,
      modelName: "ApprovalWorkflowLevel",
      tableName: APPROVAL_WORKFLOW_LEVEL_TABLE,
      underscored: true,
    },
  );

  return ApprovalWorkflowLevel;
};
