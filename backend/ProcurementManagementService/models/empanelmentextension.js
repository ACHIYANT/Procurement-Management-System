"use strict";

const { Model } = require("sequelize");
const { EMPANELMENT_EXTENSION_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class EmpanelmentExtension extends Model {
    static associate(models) {
      EmpanelmentExtension.belongsTo(models.Empanelment, {
        foreignKey: "empanelment_id",
        as: "empanelment",
      });
    }
  }

  EmpanelmentExtension.init(
    {
      empanelment_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      previous_valid_upto: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      extended_upto: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      approval_reference: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      approval_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      approval_document_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "EmpanelmentExtension",
      tableName: EMPANELMENT_EXTENSION_TABLE,
      underscored: true,
    },
  );

  return EmpanelmentExtension;
};
