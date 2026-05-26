"use strict";

const { Model } = require("sequelize");
const { PURCHASE_ORDER_CONSIGNEE_ITEM_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrderConsigneeItem extends Model {
    static associate(models) {
      PurchaseOrderConsigneeItem.belongsTo(models.PurchaseOrderConsignee, {
        foreignKey: "consignee_id",
        as: "consignee",
      });
      PurchaseOrderConsigneeItem.belongsTo(models.PurchaseOrderItem, {
        foreignKey: "purchase_order_item_id",
        as: "purchase_order_item",
      });
    }
  }

  PurchaseOrderConsigneeItem.init(
    {
      consignee_id: { type: DataTypes.INTEGER, allowNull: false },
      purchase_order_item_id: { type: DataTypes.INTEGER, allowNull: false },
      allocated_quantity: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      remarks: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "PurchaseOrderConsigneeItem",
      tableName: PURCHASE_ORDER_CONSIGNEE_ITEM_TABLE,
      underscored: true,
    },
  );

  return PurchaseOrderConsigneeItem;
};
