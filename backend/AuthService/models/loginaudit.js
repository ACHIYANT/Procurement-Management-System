"use strict";

const { Model } = require("sequelize");
const { LOGIN_AUDIT_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class LoginAudit extends Model {
    static associate(models) {
      LoginAudit.belongsTo(models.User, {
        foreignKey: "user_id",
        as: "user",
      });
    }
  }

  LoginAudit.init(
    {
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      empcode: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      login_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      ip_encrypted: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      ip_hash: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      user_agent: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "LoginAudit",
      tableName: LOGIN_AUDIT_TABLE,
    },
  );

  return LoginAudit;
};
