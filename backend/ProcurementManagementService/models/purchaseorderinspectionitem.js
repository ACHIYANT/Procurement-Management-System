"use strict";

const { Model } = require("sequelize");
const { PURCHASE_ORDER_INSPECTION_ITEM_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrderInspectionItem extends Model {
    static associate(models) {
      PurchaseOrderInspectionItem.belongsTo(models.PurchaseOrderInspection, {
        foreignKey: "inspection_id",
        as: "inspection",
      });
      PurchaseOrderInspectionItem.belongsTo(models.PurchaseOrderItem, {
        foreignKey: "purchase_order_item_id",
        as: "purchase_order_item",
      });
    }
  }

  PurchaseOrderInspectionItem.init(
    {
      inspection_id: { type: DataTypes.INTEGER, allowNull: false },
      purchase_order_item_id: { type: DataTypes.INTEGER, allowNull: false },
      offered_quantity: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      accepted_quantity: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      remarks: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "PurchaseOrderInspectionItem",
      tableName: PURCHASE_ORDER_INSPECTION_ITEM_TABLE,
      underscored: true,
    },
  );

  return PurchaseOrderInspectionItem;
};
