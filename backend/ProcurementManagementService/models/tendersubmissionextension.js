"use strict";

const { Model } = require("sequelize");
const { TENDER_EXTENSION_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class TenderSubmissionExtension extends Model {
    static associate(models) {
      TenderSubmissionExtension.belongsTo(models.Tender, {
        foreignKey: "tender_id",
        as: "tender",
      });
    }
  }

  TenderSubmissionExtension.init(
    {
      tender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      previous_submission_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      extended_upto_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      extension_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      approval_reference: {
        type: DataTypes.STRING(160),
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
      modelName: "TenderSubmissionExtension",
      tableName: TENDER_EXTENSION_TABLE,
      underscored: true,
    },
  );

  return TenderSubmissionExtension;
};
