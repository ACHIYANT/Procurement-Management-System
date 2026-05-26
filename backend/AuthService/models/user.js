"use strict";

const { Model } = require("sequelize");
const bcrypt = require("bcrypt");
const { SALT_ROUNDS } = require("../src/config/server-config");
const {
  USER_ROLE_TABLE,
  USER_TABLE,
} = require("../src/constants/table-names");
const {
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX,
} = require("../src/utils/password-policy");

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.belongsToMany(models.Role, {
        through: USER_ROLE_TABLE,
        as: "roles",
        foreignKey: "user_id",
        otherKey: "role_id",
      });
    }
  }

  User.init(
    {
      empcode: {
        type: DataTypes.STRING(30),
        allowNull: false,
        unique: true,
      },
      fullname: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      mobileno: {
        type: DataTypes.STRING(10),
        unique: true,
        allowNull: false,
        validate: {
          is: {
            args: /^[6-9]\d{9}$/,
            msg: "Mobile number must be 10 digits and start with 6-9.",
          },
        },
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          is: {
            args: PASSWORD_POLICY_REGEX,
            msg: PASSWORD_POLICY_MESSAGE,
          },
        },
      },
      designation: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      department: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      location_scope: {
        type: DataTypes.STRING(80),
        allowNull: false,
        set(value) {
          this.setDataValue(
            "location_scope",
            String(value || "").trim().replace(/\s+/g, " ").toUpperCase(),
          );
        },
      },
      must_change_password: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      password_version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      password_changed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "User",
      tableName: USER_TABLE,
    },
  );

  User.beforeSave((user) => {
    if (!user.changed("password")) return;
    user.password = bcrypt.hashSync(user.password, Number(SALT_ROUNDS || 12));
  });

  return User;
};
