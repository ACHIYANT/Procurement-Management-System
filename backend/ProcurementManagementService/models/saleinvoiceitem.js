"use strict";

const { Model } = require("sequelize");
const { SALE_INVOICE_ITEM_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class SaleInvoiceItem extends Model {
    static associate(models) {
      SaleInvoiceItem.belongsTo(models.SaleInvoice, {
        foreignKey: "sale_invoice_id",
        as: "sale_invoice",
      });
      SaleInvoiceItem.belongsTo(models.PurchaseOrderItem, {
        foreignKey: "purchase_order_item_id",
        as: "purchase_order_item",
      });
      SaleInvoiceItem.belongsTo(models.PurchaseOrderConsignee, {
        foreignKey: "consignee_id",
        as: "consignee",
      });
    }
  }

  SaleInvoiceItem.init(
    {
      sale_invoice_id: { type: DataTypes.INTEGER, allowNull: false },
      purchase_order_item_id: { type: DataTypes.INTEGER, allowNull: false },
      consignee_id: { type: DataTypes.INTEGER, allowNull: true },
      quantity: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      base_unit_rate: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      consultancy_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      final_unit_rate: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      gst_percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      taxable_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      gst_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      total_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    },
    {
      sequelize,
      modelName: "SaleInvoiceItem",
      tableName: SALE_INVOICE_ITEM_TABLE,
      underscored: true,
    },
  );

  return SaleInvoiceItem;
};
