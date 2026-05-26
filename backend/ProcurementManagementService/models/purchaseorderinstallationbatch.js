"use strict";

const { Model } = require("sequelize");
const { PURCHASE_ORDER_INSTALLATION_BATCH_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrderInstallationBatch extends Model {
    static associate(models) {
      PurchaseOrderInstallationBatch.belongsTo(models.PurchaseOrder, {
        foreignKey: "purchase_order_id",
        as: "purchase_order",
      });
      PurchaseOrderInstallationBatch.hasMany(models.PurchaseOrderInstallationItem, {
        foreignKey: "installation_batch_id",
        as: "items",
      });
    }
  }

  PurchaseOrderInstallationBatch.init(
    {
      purchase_order_id: { type: DataTypes.INTEGER, allowNull: false },
      installation_type: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "normal",
      },
      report_path: { type: DataTypes.STRING(500), allowNull: true },
      noc_path: { type: DataTypes.STRING(500), allowNull: true },
      declaration_path: { type: DataTypes.STRING(500), allowNull: true },
      remarks: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "PurchaseOrderInstallationBatch",
      tableName: PURCHASE_ORDER_INSTALLATION_BATCH_TABLE,
      underscored: true,
    },
  );

  return PurchaseOrderInstallationBatch;
};
