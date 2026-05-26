"use strict";

const { Model } = require("sequelize");
const { PURCHASE_ORDER_DELIVERY_BATCH_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrderDeliveryBatch extends Model {
    static associate(models) {
      PurchaseOrderDeliveryBatch.belongsTo(models.PurchaseOrder, {
        foreignKey: "purchase_order_id",
        as: "purchase_order",
      });
      PurchaseOrderDeliveryBatch.hasMany(models.PurchaseOrderDeliveryItem, {
        foreignKey: "delivery_batch_id",
        as: "items",
      });
    }
  }

  PurchaseOrderDeliveryBatch.init(
    {
      purchase_order_id: { type: DataTypes.INTEGER, allowNull: false },
      delivery_challan_no: { type: DataTypes.STRING(100), allowNull: true },
      delivery_challan_date: { type: DataTypes.DATEONLY, allowNull: true },
      seller_invoice_no: { type: DataTypes.STRING(100), allowNull: true },
      seller_invoice_date: { type: DataTypes.DATEONLY, allowNull: true },
      delivery_document_path: { type: DataTypes.STRING(500), allowNull: true },
      invoice_document_path: { type: DataTypes.STRING(500), allowNull: true },
      remarks: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "PurchaseOrderDeliveryBatch",
      tableName: PURCHASE_ORDER_DELIVERY_BATCH_TABLE,
      underscored: true,
    },
  );

  return PurchaseOrderDeliveryBatch;
};
