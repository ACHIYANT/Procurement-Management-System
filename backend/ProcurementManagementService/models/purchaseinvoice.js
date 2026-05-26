"use strict";

const { Model } = require("sequelize");
const { PURCHASE_INVOICE_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class PurchaseInvoice extends Model {
    static associate(models) {
      PurchaseInvoice.belongsTo(models.PurchaseOrder, {
        foreignKey: "purchase_order_id",
        as: "purchase_order",
      });
      PurchaseInvoice.belongsTo(models.SellerInvoice, {
        foreignKey: "seller_invoice_id",
        as: "seller_invoice",
      });
    }
  }

  PurchaseInvoice.init(
    {
      purchase_order_id: { type: DataTypes.INTEGER, allowNull: false },
      seller_invoice_id: { type: DataTypes.INTEGER, allowNull: false },
      voucher_no: { type: DataTypes.STRING(100), allowNull: false },
      voucher_date: { type: DataTypes.DATEONLY, allowNull: false },
      tds_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      round_off: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      gross_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      grand_total: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      bill_document_path: { type: DataTypes.STRING(500), allowNull: true },
      remarks: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "PurchaseInvoice",
      tableName: PURCHASE_INVOICE_TABLE,
      underscored: true,
    },
  );

  return PurchaseInvoice;
};
