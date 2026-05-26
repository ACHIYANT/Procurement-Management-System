"use strict";

const { Model } = require("sequelize");
const { PURCHASE_ORDER_DELIVERY_ITEM_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrderDeliveryItem extends Model {
    static associate(models) {
      PurchaseOrderDeliveryItem.belongsTo(models.PurchaseOrderDeliveryBatch, {
        foreignKey: "delivery_batch_id",
        as: "delivery_batch",
      });
      PurchaseOrderDeliveryItem.belongsTo(models.PurchaseOrderItem, {
        foreignKey: "purchase_order_item_id",
        as: "purchase_order_item",
      });
      PurchaseOrderDeliveryItem.belongsTo(models.PurchaseOrderConsignee, {
        foreignKey: "consignee_id",
        as: "consignee",
      });
    }
  }

  PurchaseOrderDeliveryItem.init(
    {
      delivery_batch_id: { type: DataTypes.INTEGER, allowNull: false },
      purchase_order_item_id: { type: DataTypes.INTEGER, allowNull: false },
      consignee_id: { type: DataTypes.INTEGER, allowNull: false },
      delivered_quantity: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      remarks: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "PurchaseOrderDeliveryItem",
      tableName: PURCHASE_ORDER_DELIVERY_ITEM_TABLE,
      underscored: true,
    },
  );

  return PurchaseOrderDeliveryItem;
};
