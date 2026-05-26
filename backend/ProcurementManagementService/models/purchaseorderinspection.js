"use strict";

const { Model } = require("sequelize");
const { PURCHASE_ORDER_INSPECTION_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrderInspection extends Model {
    static associate(models) {
      PurchaseOrderInspection.belongsTo(models.PurchaseOrder, {
        foreignKey: "purchase_order_id",
        as: "purchase_order",
      });
      PurchaseOrderInspection.hasMany(models.PurchaseOrderInspectionItem, {
        foreignKey: "inspection_id",
        as: "items",
      });
    }
  }

  PurchaseOrderInspection.init(
    {
      purchase_order_id: { type: DataTypes.INTEGER, allowNull: false },
      inspection_date: { type: DataTypes.DATEONLY, allowNull: false },
      inspection_note_path: { type: DataTypes.STRING(500), allowNull: true },
      remarks: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "PurchaseOrderInspection",
      tableName: PURCHASE_ORDER_INSPECTION_TABLE,
      underscored: true,
    },
  );

  return PurchaseOrderInspection;
};
