"use strict";

const { Model } = require("sequelize");
const { PURCHASE_ORDER_PAYMENT_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrderPayment extends Model {
    static associate(models) {
      PurchaseOrderPayment.belongsTo(models.PurchaseOrder, {
        foreignKey: "po_id",
        as: "purchase_order",
      });
    }
  }

  PurchaseOrderPayment.init(
    {
      po_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      payment_stage: {
        type: DataTypes.STRING(120),
        allowNull: false,
        validate: { notEmpty: true },
      },
      payment_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      payment_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      payment_reference_no: {
        type: DataTypes.STRING(140),
        allowNull: true,
      },
      payment_noting_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "PurchaseOrderPayment",
      tableName: PURCHASE_ORDER_PAYMENT_TABLE,
      underscored: true,
    },
  );

  return PurchaseOrderPayment;
};
