"use strict";

const { Model } = require("sequelize");
const { FIRM_CONTACT_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class FirmContact extends Model {
    static associate(models) {
      FirmContact.belongsTo(models.Firm, {
        foreignKey: "firm_id",
        as: "firm",
      });
    }
  }

  FirmContact.init(
    {
      firm_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      contact_person_name: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      designation: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      contact_type: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "mobile",
      },
      contact_value: {
        type: DataTypes.STRING(180),
        allowNull: false,
      },
      is_primary: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
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
      modelName: "FirmContact",
      tableName: FIRM_CONTACT_TABLE,
      underscored: true,
    },
  );

  return FirmContact;
};
