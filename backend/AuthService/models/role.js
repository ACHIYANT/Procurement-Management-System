"use strict";

const { Model } = require("sequelize");
const {
  ROLE_TABLE,
  USER_ROLE_TABLE,
} = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class Role extends Model {
    static associate(models) {
      Role.belongsToMany(models.User, {
        through: USER_ROLE_TABLE,
        as: "users",
        foreignKey: "role_id",
        otherKey: "user_id",
      });
    }
  }

  Role.init(
    {
      name: {
        type: DataTypes.STRING(80),
        allowNull: false,
        unique: true,
      },
    },
    {
      sequelize,
      modelName: "Role",
      tableName: ROLE_TABLE,
    },
  );

  return Role;
};
