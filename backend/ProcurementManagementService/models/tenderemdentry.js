"use strict";

const { Model } = require("sequelize");
const { TENDER_EMD_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class TenderEmdEntry extends Model {
    static associate(models) {
      TenderEmdEntry.belongsTo(models.Tender, {
        foreignKey: "tender_id",
        as: "tender",
      });
      TenderEmdEntry.belongsTo(models.TenderVendor, {
        foreignKey: "tender_vendor_id",
        as: "tender_vendor",
      });
    }
  }

  TenderEmdEntry.init(
    {
      tender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tender_vendor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      emd_required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      emd_submission_status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "not_submitted",
      },
      emd_exemption_status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "none",
      },
      emd_exemption_reason: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      tender_fee_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      emd_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      submission_mode: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      instrument_no: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      issuing_bank_name: {
        type: DataTypes.STRING(180),
        allowNull: true,
      },
      utr_no: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      bg_no: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      bg_valid_upto: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      bg_claim_period_upto: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      deposit_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      finance_reference_no: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      submission_document_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      is_retained_after_technical_eval: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      refund_status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "not_due",
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
      modelName: "TenderEmdEntry",
      tableName: TENDER_EMD_TABLE,
      underscored: true,
    },
  );

  return TenderEmdEntry;
};
