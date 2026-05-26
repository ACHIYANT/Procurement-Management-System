"use strict";

const { Model } = require("sequelize");
const { SELLER_INVOICE_ITEM_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class SellerInvoiceItem extends Model {
    static associate(models) {
      SellerInvoiceItem.belongsTo(models.SellerInvoice, {
        foreignKey: "seller_invoice_id",
        as: "seller_invoice",
      });
      SellerInvoiceItem.belongsTo(models.PurchaseOrderItem, {
        foreignKey: "purchase_order_item_id",
        as: "purchase_order_item",
      });
      SellerInvoiceItem.belongsTo(models.PurchaseOrderConsignee, {
        foreignKey: "consignee_id",
        as: "consignee",
      });
    }
  }

  SellerInvoiceItem.init(
    {
      seller_invoice_id: { type: DataTypes.INTEGER, allowNull: false },
      purchase_order_item_id: { type: DataTypes.INTEGER, allowNull: false },
      consignee_id: { type: DataTypes.INTEGER, allowNull: true },
      quantity: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      unit_rate: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      gst_percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      taxable_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      gst_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      total_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    },
    {
      sequelize,
      modelName: "SellerInvoiceItem",
      tableName: SELLER_INVOICE_ITEM_TABLE,
      underscored: true,
    },
  );

  return SellerInvoiceItem;
};
