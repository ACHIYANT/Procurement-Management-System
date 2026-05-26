"use strict";

const { Model } = require("sequelize");
const {
  PROCUREMENT_EMPLOYEE_TABLE,
} = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class ProcurementEmployee extends Model {
    static associate(models) {
      ProcurementEmployee.hasMany(models.IndentItem, {
        foreignKey: "assigned_procurement_officer_id",
        as: "assigned_indent_items",
      });
      ProcurementEmployee.hasMany(models.ProcurementCase, {
        foreignKey: "procurement_officer_id",
        as: "procurement_cases",
      });
    }
  }

  ProcurementEmployee.init(
    {
      empcode: {
        type: DataTypes.STRING(30),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
        },
      },
      employee_name: {
        type: DataTypes.STRING(120),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      mobile_no: {
        type: DataTypes.STRING(10),
        allowNull: false,
        validate: {
          is: {
            args: /^[6-9]\d{9}$/,
            msg: "Mobile number must be a valid 10 digit number starting with 6-9.",
          },
        },
      },
      designation: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      assigned_roles: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "[]",
        get() {
          const rawValue = this.getDataValue("assigned_roles");
          if (!rawValue) return [];
          try {
            return Array.isArray(rawValue) ? rawValue : JSON.parse(rawValue);
          } catch {
            return [];
          }
        },
        set(value) {
          this.setDataValue("assigned_roles", JSON.stringify(Array.isArray(value) ? value : []));
        },
      },
      division: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      location_scope: {
        type: DataTypes.STRING(80),
        allowNull: false,
        set(value) {
          this.setDataValue(
            "location_scope",
            String(value || "").trim().replace(/\s+/g, " ").toUpperCase(),
          );
        },
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: "ProcurementEmployee",
      tableName: PROCUREMENT_EMPLOYEE_TABLE,
    },
  );

  return ProcurementEmployee;
};
