"use strict";

const {
  LOGIN_AUDIT_TABLE,
  USER_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(LOGIN_AUDIT_TABLE, {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: USER_TABLE,
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      empcode: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      login_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      ip_encrypted: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      ip_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      user_agent: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex(LOGIN_AUDIT_TABLE, ["user_id", "login_at"]);
    await queryInterface.addIndex(LOGIN_AUDIT_TABLE, ["empcode", "login_at"]);
    await queryInterface.addIndex(LOGIN_AUDIT_TABLE, ["login_at"]);
    await queryInterface.addIndex(LOGIN_AUDIT_TABLE, ["ip_hash"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable(LOGIN_AUDIT_TABLE);
  },
};
