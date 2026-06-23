"use strict";

const { Model } = require("sequelize");
const { TENDER_TABLE } = require("../src/constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class Tender extends Model {
    static associate(models) {
      Tender.belongsTo(models.ProcurementCase, {
        foreignKey: "procurement_case_id",
        as: "procurement_case",
      });
      Tender.hasMany(models.TenderVendor, {
        foreignKey: "tender_id",
        as: "vendors",
      });
      Tender.hasMany(models.TenderItem, {
        foreignKey: "tender_id",
        as: "items",
      });
      Tender.hasMany(models.TenderSubmissionExtension, {
        foreignKey: "tender_id",
        as: "submission_extensions",
      });
      Tender.hasMany(models.TenderEmdEntry, {
        foreignKey: "tender_id",
        as: "emd_entries",
      });
      Tender.hasMany(models.PurchaseOrder, {
        foreignKey: "tender_id",
        as: "purchase_orders",
      });
      Tender.hasOne(models.TenderPbgSetup, {
        foreignKey: "tender_id",
        as: "pbg_setup",
      });
      Tender.hasMany(models.PbgObligation, {
        foreignKey: "tender_id",
        as: "pbg_obligations",
      });
      Tender.hasMany(models.PbgEntry, {
        foreignKey: "tender_id",
        as: "pbg_receipts",
      });
      Tender.hasMany(models.CommitteeMeeting, {
        foreignKey: "tender_id",
        as: "committee_meetings",
      });
    }
  }

  Tender.init(
    {
      procurement_case_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      file_no: {
        type: DataTypes.STRING(120),
        allowNull: false,
        validate: { notEmpty: true },
      },
      tender_reference_no: {
        type: DataTypes.STRING(80),
        allowNull: true,
        validate: { notEmpty: true },
      },
      tender_type: {
        type: DataTypes.STRING(60),
        allowNull: false,
        defaultValue: "open_tender",
      },
      rate_contract_type: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      portal_type: {
        type: DataTypes.ENUM("gem", "nic", "gem_nic_split", "empanelled", "direct_market", "known_vendor"),
        allowNull: false,
      },
      tender_title: {
        type: DataTypes.STRING(250),
        allowNull: false,
        validate: { notEmpty: true },
      },
      portal_bid_no: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      portal_ra_no: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      ra_start_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      ra_end_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      ra_remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      portal_tender_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      leg_label: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      allocation_quantity: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      tender_value: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      price_bid_valid_upto: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      technical_bid_validity_applicable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      technical_bid_valid_upto: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      loa_allocation_scope: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      emd_exemption_policy: {
        type: DataTypes.STRING(60),
        allowNull: false,
        defaultValue: "none",
      },
      emd_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      tender_fee_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      bid_publish_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      bid_submission_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      bid_opening_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      current_submission_deadline: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "draft",
      },
      document_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      location_scope: {
        type: DataTypes.STRING(80),
        allowNull: false,
        set(value) {
          this.setDataValue("location_scope", String(value || "").trim().replace(/\s+/g, " ").toUpperCase());
        },
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
      modelName: "Tender",
      tableName: TENDER_TABLE,
      underscored: true,
    },
  );

  return Tender;
};
