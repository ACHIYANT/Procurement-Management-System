"use strict";

const { Model } = require("sequelize");
const { SALE_INVOICE_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class SaleInvoice extends Model {
    static associate(models) {
      SaleInvoice.belongsTo(models.PurchaseOrder, {
        foreignKey: "purchase_order_id",
        as: "purchase_order",
      });
      SaleInvoice.hasMany(models.SaleInvoiceItem, {
        foreignKey: "sale_invoice_id",
        as: "items",
      });
    }
  }

  SaleInvoice.init(
    {
      purchase_order_id: { type: DataTypes.INTEGER, allowNull: false },
      sale_invoice_no: { type: DataTypes.STRING(100), allowNull: false },
      sale_invoice_date: { type: DataTypes.DATEONLY, allowNull: false },
      billing_mode: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "consolidated" },
      bill_to: { type: DataTypes.TEXT, allowNull: false },
      ship_to: { type: DataTypes.TEXT, allowNull: true },
      consultancy_charge_type: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "percentage" },
      consultancy_percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      consultancy_flat_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
      taxable_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      gst_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      round_off: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      grand_total: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      invoice_document_path: { type: DataTypes.STRING(500), allowNull: true },
      remarks: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "SaleInvoice",
      tableName: SALE_INVOICE_TABLE,
      underscored: true,
    },
  );

  return SaleInvoice;
};
