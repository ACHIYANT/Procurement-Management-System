"use strict";

const { Model } = require("sequelize");
const { APPROVAL_REQUEST_STEP_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class ApprovalRequestStep extends Model {
    static associate(models) {
      ApprovalRequestStep.belongsTo(models.ApprovalRequest, {
        foreignKey: "approval_request_id",
        as: "approval_request",
      });
      ApprovalRequestStep.belongsTo(models.ProcurementEmployee, {
        foreignKey: "approver_employee_id",
        as: "approver_employee",
      });
      ApprovalRequestStep.belongsTo(models.ProcurementEmployee, {
        foreignKey: "approved_by_employee_id",
        as: "approved_by_employee",
      });
    }
  }

  ApprovalRequestStep.init(
    {
      approval_request_id: { type: DataTypes.INTEGER, allowNull: false },
      level_no: { type: DataTypes.INTEGER, allowNull: false },
      level_name: { type: DataTypes.STRING(160), allowNull: false },
      approver_type: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "role" },
      approver_role: { type: DataTypes.STRING(80), allowNull: true },
      approver_employee_id: { type: DataTypes.INTEGER, allowNull: true },
      min_required_approvals: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "pending" },
      approved_by_employee_id: { type: DataTypes.INTEGER, allowNull: true },
      approved_by_name: { type: DataTypes.STRING(160), allowNull: true },
      approved_at: { type: DataTypes.DATE, allowNull: true },
      remarks: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "ApprovalRequestStep",
      tableName: APPROVAL_REQUEST_STEP_TABLE,
      underscored: true,
    },
  );

  return ApprovalRequestStep;
};
