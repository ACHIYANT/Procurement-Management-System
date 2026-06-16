"use strict";

const { Model } = require("sequelize");
const { INDENT_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class Indent extends Model {
    static associate(models) {
      Indent.belongsTo(models.ProcurementEmployee, {
        foreignKey: "created_by",
        as: "creator",
      });
      Indent.belongsTo(models.ProcurementEmployee, {
        foreignKey: "updated_by",
        as: "updater",
      });
      Indent.hasMany(models.IndentItem, {
        foreignKey: "indent_id",
        as: "items",
      });
      Indent.hasMany(models.IndentDocument, {
        foreignKey: "indent_id",
        as: "documents",
      });
      Indent.hasMany(models.ProcurementCase, {
        foreignKey: "indent_id",
        as: "procurement_cases",
      });
    }
  }

  Indent.init(
    {
      indent_no: {
        type: DataTypes.STRING(120),
        allowNull: true,
        unique: true,
      },
      system_indent_no: {
        type: DataTypes.STRING(140),
        allowNull: true,
        unique: true,
      },
      indent_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      department_name: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      cfms_no: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      received_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      indent_document_path: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      administrative_approval_document_path: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      specification_document_path: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      administrative_approval_remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "received",
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
      modelName: "Indent",
      tableName: INDENT_TABLE,
      underscored: true,
    },
  );

  return Indent;
};
