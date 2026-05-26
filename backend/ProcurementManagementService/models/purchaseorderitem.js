"use strict";

const { Model } = require("sequelize");
const { PURCHASE_ORDER_ITEM_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrderItem extends Model {
    static associate(models) {
      PurchaseOrderItem.belongsTo(models.PurchaseOrder, {
        foreignKey: "purchase_order_id",
        as: "purchase_order",
      });
      PurchaseOrderItem.belongsTo(models.TenderItem, {
        foreignKey: "tender_item_id",
        as: "tender_item",
      });
      PurchaseOrderItem.belongsTo(models.IndentItem, {
        foreignKey: "indent_item_id",
        as: "indent_item",
      });
      PurchaseOrderItem.hasMany(models.PurchaseOrderInspectionItem, {
        foreignKey: "purchase_order_item_id",
        as: "inspection_items",
      });
      PurchaseOrderItem.hasMany(models.PurchaseOrderDeliveryItem, {
        foreignKey: "purchase_order_item_id",
        as: "delivery_items",
      });
      PurchaseOrderItem.hasMany(models.PurchaseOrderInstallationItem, {
        foreignKey: "purchase_order_item_id",
        as: "installation_items",
      });
    }
  }

  PurchaseOrderItem.init(
    {
      purchase_order_id: { type: DataTypes.INTEGER, allowNull: false },
      tender_item_id: { type: DataTypes.INTEGER, allowNull: true },
      indent_item_id: { type: DataTypes.INTEGER, allowNull: true },
      item_name: { type: DataTypes.STRING(255), allowNull: false },
      item_description: { type: DataTypes.TEXT, allowNull: true },
      make: { type: DataTypes.STRING(150), allowNull: true },
      model: { type: DataTypes.STRING(150), allowNull: true },
      quantity: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      unit: { type: DataTypes.STRING(40), allowNull: true },
      unit_rate: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
      gst_percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      installation_required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      installation_mode: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "normal",
      },
      remarks: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "PurchaseOrderItem",
      tableName: PURCHASE_ORDER_ITEM_TABLE,
      underscored: true,
    },
  );

  return PurchaseOrderItem;
};
