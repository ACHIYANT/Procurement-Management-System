"use strict";

const { Model } = require("sequelize");
const { TENDER_PBG_SETUP_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class TenderPbgSetup extends Model {
    static associate(models) {
      TenderPbgSetup.belongsTo(models.Tender, {
        foreignKey: "tender_id",
        as: "tender",
      });
    }
  }

  TenderPbgSetup.init(
    {
      tender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
      },
      pbg_mode: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "po_wise",
      },
      default_pbg_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      additional_claim_months: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 6,
      },
      additional_claim_days: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      warning_before_days: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30,
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
      modelName: "TenderPbgSetup",
      tableName: TENDER_PBG_SETUP_TABLE,
      underscored: true,
    },
  );

  return TenderPbgSetup;
};
