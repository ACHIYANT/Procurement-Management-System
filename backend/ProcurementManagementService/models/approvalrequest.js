"use strict";

const { Model } = require("sequelize");
const { APPROVAL_REQUEST_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class ApprovalRequest extends Model {
    static associate(models) {
      ApprovalRequest.belongsTo(models.ApprovalWorkflow, {
        foreignKey: "approval_workflow_id",
        as: "workflow",
      });
      ApprovalRequest.belongsTo(models.ProcurementEmployee, {
        foreignKey: "requested_by_employee_id",
        as: "requested_by_employee",
      });
      ApprovalRequest.hasMany(models.ApprovalRequestStep, {
        foreignKey: "approval_request_id",
        as: "steps",
      });
      ApprovalRequest.hasOne(models.ApprovalRequestPayload, {
        foreignKey: "approval_request_id",
        as: "payload",
      });
    }
  }

  ApprovalRequest.init(
    {
      approval_workflow_id: { type: DataTypes.INTEGER, allowNull: true },
      module_key: { type: DataTypes.STRING(80), allowNull: false },
      action_key: { type: DataTypes.STRING(120), allowNull: false },
      entity_type: { type: DataTypes.STRING(100), allowNull: false },
      entity_id: { type: DataTypes.STRING(80), allowNull: false },
      request_title: { type: DataTypes.STRING(220), allowNull: false },
      request_reason: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "pending" },
      current_level_no: { type: DataTypes.INTEGER, allowNull: true },
      requested_by_employee_id: { type: DataTypes.INTEGER, allowNull: true },
      requested_by_name: { type: DataTypes.STRING(160), allowNull: true },
      applied_at: { type: DataTypes.DATE, allowNull: true },
      rejected_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: "ApprovalRequest",
      tableName: APPROVAL_REQUEST_TABLE,
      underscored: true,
    },
  );

  return ApprovalRequest;
};
