"use strict";

const {
  FIRM_TABLE,
  PBG_TABLE,
  PURCHASE_ORDER_TABLE,
  TENDER_EMD_TABLE,
  TENDER_TABLE,
  TENDER_VENDOR_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(FIRM_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      firm_code: { type: Sequelize.STRING(40), allowNull: false, unique: true },
      firm_name: { type: Sequelize.STRING(180), allowNull: false },
      vendor_category: { type: Sequelize.STRING(80), allowNull: false, defaultValue: "general" },
      vendor_type: { type: Sequelize.STRING(80), allowNull: true },
      gst_no: { type: Sequelize.STRING(20), allowNull: true },
      pan_no: { type: Sequelize.STRING(20), allowNull: true },
      msme_no: { type: Sequelize.STRING(80), allowNull: true },
      msme_state: { type: Sequelize.STRING(80), allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.STRING(80), allowNull: true },
      updated_by: { type: Sequelize.STRING(80), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable(TENDER_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      procurement_case_id: { type: Sequelize.INTEGER, allowNull: true },
      tender_reference_no: { type: Sequelize.STRING(120), allowNull: true },
      portal_type: { type: Sequelize.STRING(30), allowNull: false },
      tender_title: { type: Sequelize.STRING(255), allowNull: false },
      portal_bid_no: { type: Sequelize.STRING(120), allowNull: true },
      portal_ra_no: { type: Sequelize.STRING(120), allowNull: true },
      portal_tender_id: { type: Sequelize.STRING(120), allowNull: true },
      tender_value: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      emd_exemption_policy: { type: Sequelize.STRING(80), allowNull: false, defaultValue: "none" },
      emd_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      tender_fee_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      bid_publish_date: { type: Sequelize.DATEONLY, allowNull: true },
      bid_submission_date: { type: Sequelize.DATE, allowNull: true },
      bid_opening_date: { type: Sequelize.DATEONLY, allowNull: true },
      current_submission_deadline: { type: Sequelize.DATE, allowNull: true },
      status: { type: Sequelize.STRING(60), allowNull: false, defaultValue: "draft" },
      document_path: { type: Sequelize.STRING(500), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      location_scope: { type: Sequelize.STRING(80), allowNull: false },
      created_by: { type: Sequelize.STRING(80), allowNull: true },
      updated_by: { type: Sequelize.STRING(80), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable(TENDER_VENDOR_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      tender_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: TENDER_TABLE, key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      firm_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: FIRM_TABLE, key: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
      participation_status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "participated" },
      bid_submission_date: { type: Sequelize.DATEONLY, allowNull: true },
      technical_status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "pending" },
      technical_disqualification_reason: { type: Sequelize.TEXT, allowNull: true },
      commercial_status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "pending" },
      commercial_disqualification_reason: { type: Sequelize.TEXT, allowNull: true },
      is_l1: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      final_quoted_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      negotiated_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.STRING(80), allowNull: true },
      updated_by: { type: Sequelize.STRING(80), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable(TENDER_EMD_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      tender_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: TENDER_TABLE, key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      tender_vendor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: TENDER_VENDOR_TABLE, key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      emd_required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      emd_submission_status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "not_submitted" },
      emd_exemption_status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "none" },
      emd_exemption_reason: { type: Sequelize.TEXT, allowNull: true },
      tender_fee_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      emd_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      submission_mode: { type: Sequelize.STRING(40), allowNull: true },
      instrument_no: { type: Sequelize.STRING(120), allowNull: true },
      issuing_bank_name: { type: Sequelize.STRING(180), allowNull: true },
      utr_no: { type: Sequelize.STRING(120), allowNull: true },
      bg_no: { type: Sequelize.STRING(120), allowNull: true },
      bg_valid_upto: { type: Sequelize.DATEONLY, allowNull: true },
      bg_claim_period_upto: { type: Sequelize.DATEONLY, allowNull: true },
      deposit_date: { type: Sequelize.DATEONLY, allowNull: true },
      finance_reference_no: { type: Sequelize.STRING(160), allowNull: true },
      is_retained_after_technical_eval: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      refund_status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "not_due" },
      refund_date: { type: Sequelize.DATEONLY, allowNull: true },
      refund_approval_copy_path: { type: Sequelize.STRING(500), allowNull: true },
      refund_receiving_copy_path: { type: Sequelize.STRING(500), allowNull: true },
      received_by_name: { type: Sequelize.STRING(160), allowNull: true },
      received_by_designation: { type: Sequelize.STRING(160), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.STRING(80), allowNull: true },
      updated_by: { type: Sequelize.STRING(80), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable(PURCHASE_ORDER_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      tender_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: TENDER_TABLE, key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      firm_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: FIRM_TABLE, key: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
      po_no: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      po_date: { type: Sequelize.DATEONLY, allowNull: false },
      po_value: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "released" },
      inspection_required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      inspection_status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "pending" },
      delivery_status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "pending" },
      bill_submission_status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "pending" },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.STRING(80), allowNull: true },
      updated_by: { type: Sequelize.STRING(80), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable(PBG_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      po_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: PURCHASE_ORDER_TABLE, key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      firm_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: FIRM_TABLE, key: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
      pbg_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      submission_mode: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "bank_guarantee" },
      status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "active" },
      bank_guarantee_no: { type: Sequelize.STRING(120), allowNull: true },
      issuing_bank_name: { type: Sequelize.STRING(180), allowNull: true },
      issue_date: { type: Sequelize.DATEONLY, allowNull: true },
      valid_upto: { type: Sequelize.DATEONLY, allowNull: true },
      claim_period_upto: { type: Sequelize.DATEONLY, allowNull: true },
      pbg_percentage: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      document_path: { type: Sequelize.STRING(500), allowNull: true },
      refund_status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "held" },
      refund_date: { type: Sequelize.DATEONLY, allowNull: true },
      refund_approval_copy_path: { type: Sequelize.STRING(500), allowNull: true },
      refund_receiving_copy_path: { type: Sequelize.STRING(500), allowNull: true },
      received_by_name: { type: Sequelize.STRING(160), allowNull: true },
      received_by_designation: { type: Sequelize.STRING(160), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.STRING(80), allowNull: true },
      updated_by: { type: Sequelize.STRING(80), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex(TENDER_TABLE, ["portal_type", "tender_reference_no"], { name: "tenders_portal_ref_idx" });
    await queryInterface.addIndex(TENDER_VENDOR_TABLE, ["tender_id", "firm_id"], { unique: true, name: "tender_vendors_unique_firm" });
    await queryInterface.addIndex(TENDER_EMD_TABLE, ["tender_id", "tender_vendor_id"], { unique: true, name: "tender_emd_unique_vendor" });
    await queryInterface.addIndex(PBG_TABLE, ["po_id"], { name: "pbg_entries_po_idx" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(PBG_TABLE);
    await queryInterface.dropTable(PURCHASE_ORDER_TABLE);
    await queryInterface.dropTable(TENDER_EMD_TABLE);
    await queryInterface.dropTable(TENDER_VENDOR_TABLE);
    await queryInterface.dropTable(TENDER_TABLE);
    await queryInterface.dropTable(FIRM_TABLE);
  },
};
