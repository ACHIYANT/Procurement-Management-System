"use strict";

const { Model } = require("sequelize");
const { PURCHASE_ORDER_CONSIGNEE_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrderConsignee extends Model {
    static associate(models) {
      PurchaseOrderConsignee.belongsTo(models.PurchaseOrder, {
        foreignKey: "purchase_order_id",
        as: "purchase_order",
      });
      PurchaseOrderConsignee.hasMany(models.PurchaseOrderDeliveryItem, {
        foreignKey: "consignee_id",
        as: "delivery_items",
      });
      PurchaseOrderConsignee.hasMany(models.PurchaseOrderInstallationItem, {
        foreignKey: "consignee_id",
        as: "installation_items",
      });
      PurchaseOrderConsignee.hasMany(models.PurchaseOrderConsigneeItem, {
        foreignKey: "consignee_id",
        as: "allocated_items",
      });
    }
  }

  PurchaseOrderConsignee.init(
    {
      purchase_order_id: { type: DataTypes.INTEGER, allowNull: false },
      consignee_name: { type: DataTypes.STRING(255), allowNull: false },
      consignee_address: { type: DataTypes.TEXT, allowNull: false },
      contact_no: { type: DataTypes.STRING(40), allowNull: true },
      remarks: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "PurchaseOrderConsignee",
      tableName: PURCHASE_ORDER_CONSIGNEE_TABLE,
      underscored: true,
    },
  );

  return PurchaseOrderConsignee;
};
