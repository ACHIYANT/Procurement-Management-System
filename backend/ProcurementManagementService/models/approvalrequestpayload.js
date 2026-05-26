"use strict";

const { Model } = require("sequelize");
const { APPROVAL_REQUEST_PAYLOAD_TABLE } = require("../src/constants/table-names");

const parseJson = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const stringifyJson = (value, fallback) =>
  JSON.stringify(value === undefined ? fallback : value);

module.exports = (sequelize, DataTypes) => {
  class ApprovalRequestPayload extends Model {
    static associate(models) {
      ApprovalRequestPayload.belongsTo(models.ApprovalRequest, {
        foreignKey: "approval_request_id",
        as: "approval_request",
      });
    }
  }

  ApprovalRequestPayload.init(
    {
      approval_request_id: { type: DataTypes.INTEGER, allowNull: false },
      old_payload: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
        get() {
          return parseJson(this.getDataValue("old_payload"), null);
        },
        set(value) {
          this.setDataValue("old_payload", value === null ? null : stringifyJson(value, null));
        },
      },
      proposed_payload: {
        type: DataTypes.TEXT("long"),
        allowNull: false,
        get() {
          return parseJson(this.getDataValue("proposed_payload"), {});
        },
        set(value) {
          this.setDataValue("proposed_payload", stringifyJson(value, {}));
        },
      },
      applied_payload: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
        get() {
          return parseJson(this.getDataValue("applied_payload"), null);
        },
        set(value) {
          this.setDataValue("applied_payload", value === null ? null : stringifyJson(value, null));
        },
      },
    },
    {
      sequelize,
      modelName: "ApprovalRequestPayload",
      tableName: APPROVAL_REQUEST_PAYLOAD_TABLE,
      underscored: true,
    },
  );

  return ApprovalRequestPayload;
};
