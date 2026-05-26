"use strict";

const { Model } = require("sequelize");
const { DEPARTMENT_FUND_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class DepartmentFundEntry extends Model {
    static associate(models) {
      DepartmentFundEntry.belongsTo(models.Indent, {
        foreignKey: "indent_id",
        as: "indent",
      });
      DepartmentFundEntry.belongsTo(models.Tender, {
        foreignKey: "tender_id",
        as: "tender",
      });
      DepartmentFundEntry.belongsTo(models.PurchaseOrder, {
        foreignKey: "po_id",
        as: "purchase_order",
      });
    }
  }

  DepartmentFundEntry.init(
    {
      department_name: {
        type: DataTypes.STRING(180),
        allowNull: false,
        validate: { notEmpty: true },
      },
      subject: {
        type: DataTypes.STRING(250),
        allowNull: false,
        validate: { notEmpty: true },
      },
      entry_type: {
        type: DataTypes.ENUM(
          "parked",
          "received",
          "vendor_payment",
          "adjusted",
          "refunded",
          "carry_forward",
        ),
        allowNull: false,
      },
      entry_origin: {
        type: DataTypes.ENUM(
          "department_funds",
          "historical_reconciliation",
          "system_linked",
        ),
        allowNull: false,
        defaultValue: "department_funds",
      },
      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      entry_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      reference_no: {
        type: DataTypes.STRING(140),
        allowNull: true,
      },
      financial_year: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      estimate_reference: {
        type: DataTypes.STRING(140),
        allowNull: true,
      },
      estimate_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      estimate_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      indent_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      tender_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      po_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      vendor_name: {
        type: DataTypes.STRING(180),
        allowNull: true,
      },
      noting_page_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      payment_noting_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      location_scope: {
        type: DataTypes.STRING(80),
        allowNull: false,
        defaultValue: "PANCHKULA",
        set(value) {
          this.setDataValue(
            "location_scope",
            String(value || "")
              .trim()
              .replace(/\s+/g, " ")
              .toUpperCase(),
          );
        },
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
      modelName: "DepartmentFundEntry",
      tableName: DEPARTMENT_FUND_TABLE,
      underscored: true,
    },
  );

  return DepartmentFundEntry;
};
