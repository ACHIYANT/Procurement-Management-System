"use strict";

const { Model } = require("sequelize");
const { PURCHASE_ORDER_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrder extends Model {
    static associate(models) {
      PurchaseOrder.belongsTo(models.Tender, {
        foreignKey: "tender_id",
        as: "tender",
      });
      PurchaseOrder.belongsTo(models.Firm, {
        foreignKey: "firm_id",
        as: "firm",
      });
      PurchaseOrder.hasMany(models.PurchaseOrderPayment, {
        foreignKey: "po_id",
        as: "vendor_payments",
      });
      PurchaseOrder.hasMany(models.PbgEntry, {
        foreignKey: "po_id",
        as: "pbg_entries",
      });
      PurchaseOrder.hasMany(models.PbgObligation, {
        foreignKey: "purchase_order_id",
        as: "pbg_obligations",
      });
      PurchaseOrder.hasMany(models.PurchaseOrderItem, {
        foreignKey: "purchase_order_id",
        as: "items",
      });
      PurchaseOrder.hasMany(models.PurchaseOrderConsignee, {
        foreignKey: "purchase_order_id",
        as: "consignees",
      });
      PurchaseOrder.hasMany(models.PurchaseOrderInspection, {
        foreignKey: "purchase_order_id",
        as: "inspections",
      });
      PurchaseOrder.hasMany(models.PurchaseOrderDeliveryBatch, {
        foreignKey: "purchase_order_id",
        as: "delivery_batches",
      });
      PurchaseOrder.hasMany(models.PurchaseOrderInstallationBatch, {
        foreignKey: "purchase_order_id",
        as: "installation_batches",
      });
      PurchaseOrder.hasMany(models.SellerInvoice, {
        foreignKey: "purchase_order_id",
        as: "seller_invoices",
      });
      PurchaseOrder.hasMany(models.PurchaseInvoice, {
        foreignKey: "purchase_order_id",
        as: "purchase_invoices",
      });
      PurchaseOrder.hasMany(models.SaleInvoice, {
        foreignKey: "purchase_order_id",
        as: "sale_invoices",
      });
    }
  }

  PurchaseOrder.init(
    {
      tender_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      firm_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      po_no: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: { notEmpty: true },
      },
      po_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      po_value: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      po_quantity: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      po_document_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      warranty_period: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      warranty_start_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      required_pbg_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      required_pbg_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "released",
      },
      inspection_required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      inspection_status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "pending",
      },
      delivery_status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "pending",
      },
      bill_submission_status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "pending",
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
      modelName: "PurchaseOrder",
      tableName: PURCHASE_ORDER_TABLE,
      underscored: true,
    },
  );

  return PurchaseOrder;
};
