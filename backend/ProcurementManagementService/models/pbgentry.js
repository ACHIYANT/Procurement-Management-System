"use strict";

const { Model } = require("sequelize");
const { PBG_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class PbgEntry extends Model {
    static associate(models) {
      PbgEntry.belongsTo(models.Tender, {
        foreignKey: "tender_id",
        as: "tender",
      });
      PbgEntry.belongsTo(models.PurchaseOrder, {
        foreignKey: "po_id",
        as: "purchase_order",
      });
      PbgEntry.belongsTo(models.Firm, {
        foreignKey: "firm_id",
        as: "firm",
      });
      PbgEntry.hasMany(models.PbgReceiptAllocation, {
        foreignKey: "pbg_entry_id",
        as: "receipt_allocations",
      });
    }
  }

  PbgEntry.init(
    {
      tender_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      po_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      firm_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      pbg_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      submission_mode: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "bank_guarantee",
      },
      status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "active",
      },
      bank_guarantee_no: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      issuing_bank_name: {
        type: DataTypes.STRING(180),
        allowNull: true,
      },
      issue_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      valid_upto: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      claim_period_upto: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      invocation_upto: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      pbg_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      document_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      refund_status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "held",
      },
      refund_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      refund_approval_copy_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      refund_receiving_copy_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      received_by_name: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      received_by_designation: {
        type: DataTypes.STRING(120),
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
      modelName: "PbgEntry",
      tableName: PBG_TABLE,
      underscored: true,
    },
  );

  return PbgEntry;
};
