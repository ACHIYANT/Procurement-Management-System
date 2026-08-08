"use strict";

const {
  PROCUREMENT_EMPLOYEE_TABLE,
  WORK_PUSH_NOTIFICATION_LOG_TABLE,
  WORK_PUSH_SUBSCRIPTION_TABLE,
  WORK_TASK_TABLE,
} = require("../src/constants/table-names");

const timestampColumns = (Sequelize) => ({
  created_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
  },
  updated_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
  },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(WORK_PUSH_SUBSCRIPTION_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      procurement_employee_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: PROCUREMENT_EMPLOYEE_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      endpoint_hash: { type: Sequelize.STRING(128), allowNull: false, unique: true },
      endpoint: { type: Sequelize.TEXT, allowNull: false },
      p256dh: { type: Sequelize.TEXT, allowNull: false },
      auth: { type: Sequelize.TEXT, allowNull: false },
      subscription_json: { type: Sequelize.TEXT("long"), allowNull: false },
      user_agent: { type: Sequelize.STRING(500), allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      last_seen_at: { type: Sequelize.DATE, allowNull: true },
      last_error: { type: Sequelize.TEXT, allowNull: true },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex(WORK_PUSH_SUBSCRIPTION_TABLE, ["procurement_employee_id", "is_active"], {
      name: "work_push_subscriptions_employee_active_idx",
    });

    await queryInterface.createTable(WORK_PUSH_NOTIFICATION_LOG_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      work_push_subscription_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: WORK_PUSH_SUBSCRIPTION_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      work_task_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: WORK_TASK_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      notification_key: { type: Sequelize.STRING(260), allowNull: false },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      ...timestampColumns(Sequelize),
    });

    await queryInterface.addIndex(
      WORK_PUSH_NOTIFICATION_LOG_TABLE,
      ["work_push_subscription_id", "notification_key"],
      {
        name: "work_push_notification_logs_subscription_key_uq",
        unique: true,
      },
    );
    await queryInterface.addIndex(WORK_PUSH_NOTIFICATION_LOG_TABLE, ["work_task_id", "sent_at"], {
      name: "work_push_notification_logs_task_sent_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(WORK_PUSH_NOTIFICATION_LOG_TABLE);
    await queryInterface.dropTable(WORK_PUSH_SUBSCRIPTION_TABLE);
  },
};
