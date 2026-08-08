"use strict";

const { Model } = require("sequelize");
const { WORK_PUSH_NOTIFICATION_LOG_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class WorkPushNotificationLog extends Model {
    static associate(models) {
      WorkPushNotificationLog.belongsTo(models.WorkPushSubscription, {
        foreignKey: "work_push_subscription_id",
        as: "subscription",
      });
      WorkPushNotificationLog.belongsTo(models.WorkTask, {
        foreignKey: "work_task_id",
        as: "task",
      });
    }
  }

  WorkPushNotificationLog.init(
    {
      work_push_subscription_id: { type: DataTypes.INTEGER, allowNull: false },
      work_task_id: { type: DataTypes.INTEGER, allowNull: false },
      notification_key: { type: DataTypes.STRING(260), allowNull: false },
      sent_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "WorkPushNotificationLog",
      tableName: WORK_PUSH_NOTIFICATION_LOG_TABLE,
      underscored: true,
    },
  );

  return WorkPushNotificationLog;
};
