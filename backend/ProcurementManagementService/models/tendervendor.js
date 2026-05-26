"use strict";

const { Model } = require("sequelize");
const { TENDER_VENDOR_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class TenderVendor extends Model {
    static associate(models) {
      TenderVendor.belongsTo(models.Tender, {
        foreignKey: "tender_id",
        as: "tender",
      });
      TenderVendor.belongsTo(models.Firm, {
        foreignKey: "firm_id",
        as: "firm",
      });
      TenderVendor.hasOne(models.TenderEmdEntry, {
        foreignKey: "tender_vendor_id",
        as: "emd_entry",
      });
      TenderVendor.hasMany(models.CommitteeNegotiationEntry, {
        foreignKey: "tender_vendor_id",
        as: "committee_negotiation_entries",
      });
      TenderVendor.hasMany(models.TenderVendorAllocationExtension, {
        foreignKey: "tender_vendor_id",
        as: "allocation_extensions",
      });
      TenderVendor.hasMany(models.TenderVendorItemQuote, {
        foreignKey: "tender_vendor_id",
        as: "commercial_item_quotes",
      });
      TenderVendor.hasMany(models.PbgObligation, {
        foreignKey: "tender_vendor_id",
        as: "pbg_obligations",
      });
    }
  }

  TenderVendor.init(
    {
      tender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      firm_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      participation_status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "participated",
      },
      bid_submission_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      technical_status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "pending",
      },
      technical_status_updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      technical_disqualification_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      commercial_status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "pending",
      },
      commercial_status_updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      commercial_disqualification_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      is_l1: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      final_quoted_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      negotiated_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      loa_allocation_basis: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      loa_allocated_quantity: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      loa_allocated_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      loa_rc_issue_type: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      loa_rc_issue_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      loa_rc_document_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      pbg_basis: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      pbg_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      pbg_additional_months: {
        type: DataTypes.INTEGER,
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
      modelName: "TenderVendor",
      tableName: TENDER_VENDOR_TABLE,
      underscored: true,
    },
  );

  return TenderVendor;
};
