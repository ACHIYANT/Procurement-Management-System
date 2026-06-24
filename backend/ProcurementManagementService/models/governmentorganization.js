"use strict";

const { Model } = require("sequelize");
const {
  GOVERNMENT_ORGANIZATION_TABLE,
} = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class GovernmentOrganization extends Model {}

  GovernmentOrganization.init(
    {
      organization_name: {
        type: DataTypes.STRING(220),
        allowNull: false,
        validate: { notEmpty: true },
      },
      organization_code: {
        type: DataTypes.STRING(140),
        allowNull: false,
        unique: true,
        validate: { notEmpty: true },
      },
      organization_group: {
        type: DataTypes.STRING(80),
        allowNull: false,
        defaultValue: "Department",
      },
      parent_code: {
        type: DataTypes.STRING(140),
        allowNull: true,
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: "GovernmentOrganization",
      tableName: GOVERNMENT_ORGANIZATION_TABLE,
      underscored: true,
    },
  );

  return GovernmentOrganization;
};
