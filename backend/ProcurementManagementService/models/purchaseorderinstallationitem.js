"use strict";

const { Model } = require("sequelize");
const { PURCHASE_ORDER_INSTALLATION_ITEM_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrderInstallationItem extends Model {
    static associate(models) {
      PurchaseOrderInstallationItem.belongsTo(models.PurchaseOrderInstallationBatch, {
        foreignKey: "installation_batch_id",
        as: "installation_batch",
      });
      PurchaseOrderInstallationItem.belongsTo(models.PurchaseOrderItem, {
        foreignKey: "purchase_order_item_id",
        as: "purchase_order_item",
      });
      PurchaseOrderInstallationItem.belongsTo(models.PurchaseOrderConsignee, {
        foreignKey: "consignee_id",
        as: "consignee",
      });
    }
  }

  PurchaseOrderInstallationItem.init(
    {
      installation_batch_id: { type: DataTypes.INTEGER, allowNull: false },
      purchase_order_item_id: { type: DataTypes.INTEGER, allowNull: false },
      consignee_id: { type: DataTypes.INTEGER, allowNull: false },
      installed_quantity: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      installation_completion_date: { type: DataTypes.DATEONLY, allowNull: false },
      remarks: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "PurchaseOrderInstallationItem",
      tableName: PURCHASE_ORDER_INSTALLATION_ITEM_TABLE,
      underscored: true,
    },
  );

  return PurchaseOrderInstallationItem;
};
