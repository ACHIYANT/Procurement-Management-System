"use strict";

const { Model } = require("sequelize");
const { SELLER_INVOICE_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class SellerInvoice extends Model {
    static associate(models) {
      SellerInvoice.belongsTo(models.PurchaseOrder, {
        foreignKey: "purchase_order_id",
        as: "purchase_order",
      });
      SellerInvoice.belongsTo(models.Firm, {
        foreignKey: "firm_id",
        as: "firm",
      });
      SellerInvoice.belongsTo(models.PurchaseOrderConsignee, {
        foreignKey: "consignee_id",
        as: "consignee",
      });
      SellerInvoice.hasMany(models.SellerInvoiceItem, {
        foreignKey: "seller_invoice_id",
        as: "items",
      });
      SellerInvoice.hasOne(models.PurchaseInvoice, {
        foreignKey: "seller_invoice_id",
        as: "purchase_invoice",
      });
    }
  }

  SellerInvoice.init(
    {
      purchase_order_id: { type: DataTypes.INTEGER, allowNull: false },
      firm_id: { type: DataTypes.INTEGER, allowNull: false },
      consignee_id: { type: DataTypes.INTEGER, allowNull: true },
      seller_invoice_no: { type: DataTypes.STRING(100), allowNull: false },
      seller_invoice_date: { type: DataTypes.DATEONLY, allowNull: false },
      bill_from: { type: DataTypes.TEXT, allowNull: true },
      ship_to: { type: DataTypes.TEXT, allowNull: true },
      invoice_document_path: { type: DataTypes.STRING(500), allowNull: true },
      taxable_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      gst_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      grand_total: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      remarks: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "SellerInvoice",
      tableName: SELLER_INVOICE_TABLE,
      underscored: true,
    },
  );

  return SellerInvoice;
};
