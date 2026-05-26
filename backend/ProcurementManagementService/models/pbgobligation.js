"use strict";

const { Model } = require("sequelize");
const { PBG_OBLIGATION_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class PbgObligation extends Model {
    static associate(models) {
      PbgObligation.belongsTo(models.Tender, {
        foreignKey: "tender_id",
        as: "tender",
      });
      PbgObligation.belongsTo(models.Firm, {
        foreignKey: "firm_id",
        as: "firm",
      });
      PbgObligation.belongsTo(models.PurchaseOrder, {
        foreignKey: "purchase_order_id",
        as: "purchase_order",
      });
      PbgObligation.belongsTo(models.TenderVendor, {
        foreignKey: "tender_vendor_id",
        as: "tender_vendor",
      });
      PbgObligation.hasMany(models.PbgReceiptAllocation, {
        foreignKey: "pbg_obligation_id",
        as: "receipt_allocations",
      });
    }
  }

  PbgObligation.init(
    {
      tender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tender_vendor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      firm_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      purchase_order_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      obligation_type: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      coverage_mode: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      reference_value: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      pbg_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      required_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      required_valid_upto_provisional: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      required_valid_upto_final: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      warranty_anchor_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      additional_claim_upto: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      source_reference: {
        type: DataTypes.STRING(180),
        allowNull: true,
      },
      source_reference_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      extension_reference_no: {
        type: DataTypes.STRING(180),
        allowNull: true,
      },
      extension_reference_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      extension_document_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "active",
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
      modelName: "PbgObligation",
      tableName: PBG_OBLIGATION_TABLE,
      underscored: true,
    },
  );

  return PbgObligation;
};
