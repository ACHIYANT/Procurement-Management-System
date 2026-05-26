"use strict";

const { Model } = require("sequelize");
const { FIRM_ADDRESS_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class FirmAddress extends Model {
    static associate(models) {
      FirmAddress.belongsTo(models.Firm, {
        foreignKey: "firm_id",
        as: "firm",
      });
    }
  }

  FirmAddress.init(
    {
      firm_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      address_type: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "office",
      },
      address_line_1: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      address_line_2: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      district: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      state: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      country: {
        type: DataTypes.STRING(120),
        allowNull: false,
        defaultValue: "India",
      },
      pin_code: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      landmark: {
        type: DataTypes.STRING(180),
        allowNull: true,
      },
      is_primary: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "FirmAddress",
      tableName: FIRM_ADDRESS_TABLE,
      underscored: true,
    },
  );

  return FirmAddress;
};
