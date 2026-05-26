"use strict";

const {
  COMMITTEE_MEETING_TABLE,
  COMMITTEE_MEMBER_TABLE,
  COMMITTEE_NEGOTIATION_ENTRY_TABLE,
  PROCUREMENT_CASE_TABLE,
  TENDER_TABLE,
  FIRM_TABLE,
  TENDER_VENDOR_TABLE,
  INDENT_ITEM_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(COMMITTEE_MEETING_TABLE, {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      procurement_case_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: PROCUREMENT_CASE_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      tender_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: TENDER_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      meeting_no: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      meeting_type: { type: Sequelize.STRING(60), allowNull: false },
      approval_forum: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "none" },
      meeting_date: { type: Sequelize.DATEONLY, allowNull: false },
      meeting_time: { type: Sequelize.STRING(20), allowNull: true },
      venue: { type: Sequelize.STRING(180), allowNull: true },
      agenda: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "scheduled" },
      proceedings_document_path: { type: Sequelize.STRING(500), allowNull: true },
      attendance_document_path: { type: Sequelize.STRING(500), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      location_scope: { type: Sequelize.STRING(80), allowNull: false, defaultValue: "PANCHKULA" },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });

    await queryInterface.addIndex(COMMITTEE_MEETING_TABLE, ["procurement_case_id", "meeting_type", "meeting_date"], {
      name: "committee_meetings_case_type_date_idx",
    });
    await queryInterface.addIndex(COMMITTEE_MEETING_TABLE, ["tender_id", "meeting_date"], {
      name: "committee_meetings_tender_date_idx",
    });

    await queryInterface.createTable(COMMITTEE_MEMBER_TABLE, {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      committee_meeting_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: COMMITTEE_MEETING_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      member_name: { type: Sequelize.STRING(180), allowNull: false },
      designation: { type: Sequelize.STRING(180), allowNull: true },
      organisation_name: { type: Sequelize.STRING(220), allowNull: true },
      member_group: { type: Sequelize.STRING(60), allowNull: false, defaultValue: "other" },
      attendance_status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "present" },
      payment_eligible: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      payment_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      payment_status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "pending" },
      payment_reference: { type: Sequelize.STRING(120), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });

    await queryInterface.addIndex(COMMITTEE_MEMBER_TABLE, ["committee_meeting_id", "attendance_status"], {
      name: "committee_members_meeting_attendance_idx",
    });
    await queryInterface.addIndex(COMMITTEE_MEMBER_TABLE, ["member_name", "organisation_name"], {
      name: "committee_members_name_org_idx",
    });

    await queryInterface.createTable(COMMITTEE_NEGOTIATION_ENTRY_TABLE, {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      committee_meeting_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: COMMITTEE_MEETING_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      firm_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: FIRM_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      tender_vendor_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: TENDER_VENDOR_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      indent_item_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: INDENT_ITEM_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      negotiated_quantity: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      negotiated_rate: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      accepted_quantity: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      accepted_rate: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      accepted_for_po: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      rank_order: { type: Sequelize.INTEGER, allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });

    await queryInterface.addIndex(COMMITTEE_NEGOTIATION_ENTRY_TABLE, ["committee_meeting_id", "firm_id"], {
      name: "committee_negotiation_entries_meeting_firm_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(COMMITTEE_NEGOTIATION_ENTRY_TABLE, "committee_negotiation_entries_meeting_firm_idx").catch(() => {});
    await queryInterface.dropTable(COMMITTEE_NEGOTIATION_ENTRY_TABLE).catch(() => {});
    await queryInterface.removeIndex(COMMITTEE_MEMBER_TABLE, "committee_members_name_org_idx").catch(() => {});
    await queryInterface.removeIndex(COMMITTEE_MEMBER_TABLE, "committee_members_meeting_attendance_idx").catch(() => {});
    await queryInterface.dropTable(COMMITTEE_MEMBER_TABLE).catch(() => {});
    await queryInterface.removeIndex(COMMITTEE_MEETING_TABLE, "committee_meetings_tender_date_idx").catch(() => {});
    await queryInterface.removeIndex(COMMITTEE_MEETING_TABLE, "committee_meetings_case_type_date_idx").catch(() => {});
    await queryInterface.dropTable(COMMITTEE_MEETING_TABLE).catch(() => {});
  },
};
