"use strict";

const { Model } = require("sequelize");
const { EMPANELMENT_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class Empanelment extends Model {
    static associate(models) {
      Empanelment.belongsTo(models.Firm, {
        foreignKey: "firm_id",
        as: "firm",
      });
      Empanelment.hasMany(models.EmpanelmentItemCategory, {
        foreignKey: "empanelment_id",
        as: "item_categories",
      });
      Empanelment.hasMany(models.EmpanelmentOem, {
        foreignKey: "empanelment_id",
        as: "oems",
      });
      Empanelment.hasMany(models.EmpanelmentExtension, {
        foreignKey: "empanelment_id",
        as: "extensions",
      });
    }
  }

  Empanelment.init(
    {
      firm_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      empanelment_no: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
        validate: { notEmpty: true },
      },
      valid_from: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      valid_upto: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      current_valid_upto: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "active",
      },
      approval_reference: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      approval_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      document_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
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
      modelName: "Empanelment",
      tableName: EMPANELMENT_TABLE,
      underscored: true,
    },
  );

  return Empanelment;
};
