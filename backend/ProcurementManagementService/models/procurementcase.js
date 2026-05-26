"use strict";

const { Model } = require("sequelize");
const { PROCUREMENT_CASE_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class ProcurementCase extends Model {
    static associate(models) {
      ProcurementCase.belongsTo(models.Indent, {
        foreignKey: "indent_id",
        as: "indent",
      });
      ProcurementCase.belongsTo(models.ProcurementEmployee, {
        foreignKey: "procurement_officer_id",
        as: "procurement_officer",
      });
      ProcurementCase.hasMany(models.ProcurementCaseItem, {
        foreignKey: "procurement_case_id",
        as: "case_items",
      });
      ProcurementCase.hasMany(models.Tender, {
        foreignKey: "procurement_case_id",
        as: "tenders",
      });
      ProcurementCase.hasMany(models.CommitteeMeeting, {
        foreignKey: "procurement_case_id",
        as: "committee_meetings",
      });
    }
  }

  ProcurementCase.init(
    {
      indent_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      case_no: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
        validate: { notEmpty: true },
      },
      title: {
        type: DataTypes.STRING(220),
        allowNull: false,
        validate: { notEmpty: true },
      },
      procurement_officer_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      procurement_mode: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      estimated_value: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "open",
      },
      location_scope: {
        type: DataTypes.STRING(80),
        allowNull: false,
        set(value) {
          this.setDataValue("location_scope", String(value || "").trim().replace(/\s+/g, " ").toUpperCase());
        },
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
      modelName: "ProcurementCase",
      tableName: PROCUREMENT_CASE_TABLE,
      underscored: true,
    },
  );

  return ProcurementCase;
};
