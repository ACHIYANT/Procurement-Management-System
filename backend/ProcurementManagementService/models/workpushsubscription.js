"use strict";

const { Model } = require("sequelize");
const { WORK_PUSH_SUBSCRIPTION_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class WorkPushSubscription extends Model {
    static associate(models) {
      WorkPushSubscription.belongsTo(models.ProcurementEmployee, {
        foreignKey: "procurement_employee_id",
        as: "employee",
      });
      WorkPushSubscription.hasMany(models.WorkPushNotificationLog, {
        foreignKey: "work_push_subscription_id",
        as: "notification_logs",
      });
    }
  }

  WorkPushSubscription.init(
    {
      procurement_employee_id: { type: DataTypes.INTEGER, allowNull: false },
      endpoint_hash: { type: DataTypes.STRING(128), allowNull: false },
      endpoint: { type: DataTypes.TEXT, allowNull: false },
      p256dh: { type: DataTypes.TEXT, allowNull: false },
      auth: { type: DataTypes.TEXT, allowNull: false },
      subscription_json: { type: DataTypes.TEXT("long"), allowNull: false },
      user_agent: { type: DataTypes.STRING(500), allowNull: true },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      last_seen_at: { type: DataTypes.DATE, allowNull: true },
      last_error: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "WorkPushSubscription",
      tableName: WORK_PUSH_SUBSCRIPTION_TABLE,
      underscored: true,
    },
  );

  return WorkPushSubscription;
};
