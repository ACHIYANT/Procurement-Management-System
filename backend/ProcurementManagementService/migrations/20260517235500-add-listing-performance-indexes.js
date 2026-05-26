"use strict";

const {
  INDENT_TABLE,
  TENDER_TABLE,
  PROCUREMENT_CASE_TABLE,
  PURCHASE_ORDER_TABLE,
  TENDER_EMD_TABLE,
  PBG_TABLE,
  COMMITTEE_MEETING_TABLE,
  FIRM_TABLE,
  EMPANELMENT_TABLE,
  DEPARTMENT_FUND_TABLE,
  PROCUREMENT_EMPLOYEE_TABLE,
} = require("../src/constants/table-names");

const INDEX_DEFINITIONS = [
  [INDENT_TABLE, [
    ["system_indent_no", "id"],
    ["indent_no", "id"],
    ["indent_date", "id"],
    ["received_date", "id"],
    ["department_name", "id"],
    ["status", "id"],
    ["location_scope", "id"],
  ]],
  [TENDER_TABLE, [
    ["tender_title", "id"],
    ["portal_type", "id"],
    ["leg_label", "id"],
    ["portal_bid_no", "id"],
    ["portal_ra_no", "id"],
    ["tender_reference_no", "id"],
    ["portal_tender_id", "id"],
    ["tender_value", "id"],
    ["emd_amount", "id"],
    ["location_scope", "id"],
  ]],
  [PROCUREMENT_CASE_TABLE, [
    ["case_no", "id"],
    ["title", "id"],
    ["procurement_mode", "id"],
    ["status", "id"],
    ["estimated_value", "id"],
    ["location_scope", "id"],
  ]],
  [PURCHASE_ORDER_TABLE, [
    ["po_no", "id"],
    ["po_date", "id"],
    ["po_value", "id"],
    ["po_quantity", "id"],
    ["status", "id"],
    ["inspection_status", "id"],
    ["delivery_status", "id"],
    ["warranty_start_date", "id"],
  ]],
  [TENDER_EMD_TABLE, [
    ["emd_submission_status", "id"],
    ["emd_exemption_status", "id"],
    ["submission_mode", "id"],
    ["refund_status", "id"],
    ["finance_reference_no", "id"],
    ["instrument_no", "id"],
    ["utr_no", "id"],
    ["bg_no", "id"],
    ["emd_amount", "id"],
    ["tender_fee_amount", "id"],
  ]],
  [PBG_TABLE, [
    ["bank_guarantee_no", "id"],
    ["issuing_bank_name", "id"],
    ["status", "id"],
    ["refund_status", "id"],
    ["pbg_amount", "id"],
    ["valid_upto", "id"],
    ["claim_period_upto", "id"],
  ]],
  [COMMITTEE_MEETING_TABLE, [
    ["meeting_no", "id"],
    ["meeting_type", "id"],
    ["purpose", "id"],
    ["meeting_date", "id"],
    ["meeting_time", "id"],
    ["approval_forum", "id"],
    ["venue", "id"],
  ]],
  [FIRM_TABLE, [
    ["firm_name", "id"],
    ["firm_code", "id"],
    ["vendor_category", "id"],
    ["vendor_type", "id"],
    ["gst_no", "id"],
    ["pan_no", "id"],
    ["is_active", "id"],
  ]],
  [EMPANELMENT_TABLE, [
    ["empanelment_no", "id"],
    ["status", "id"],
    ["valid_from", "id"],
    ["valid_upto", "id"],
    ["current_valid_upto", "id"],
  ]],
  [DEPARTMENT_FUND_TABLE, [
    ["department_name", "id"],
    ["subject", "id"],
    ["entry_type", "id"],
    ["entry_origin", "id"],
    ["amount", "id"],
    ["entry_date", "id"],
    ["reference_no", "id"],
    ["financial_year", "id"],
  ]],
  [PROCUREMENT_EMPLOYEE_TABLE, [
    ["empcode", "id"],
    ["employee_name", "id"],
    ["designation", "id"],
    ["division", "id"],
    ["mobile_no", "id"],
    ["location_scope", "id"],
    ["is_active", "id"],
  ]],
];

const toIndexName = (tableName, fields) =>
  `idx_${tableName}_${fields.join("_")}`.slice(0, 63);

module.exports = {
  async up(queryInterface) {
    for (const [tableName, definitions] of INDEX_DEFINITIONS) {
      const existingIndexes = await queryInterface.showIndex(tableName);
      const existingNames = new Set(existingIndexes.map((index) => index.name));
      for (const fields of definitions) {
        const name = toIndexName(tableName, fields);
        if (existingNames.has(name)) continue;
        await queryInterface.addIndex(tableName, fields, { name });
      }
    }
  },

  async down(queryInterface) {
    for (const [tableName, definitions] of INDEX_DEFINITIONS) {
      const existingIndexes = await queryInterface.showIndex(tableName);
      const existingNames = new Set(existingIndexes.map((index) => index.name));
      for (const fields of definitions) {
        const name = toIndexName(tableName, fields);
        if (!existingNames.has(name)) continue;
        await queryInterface.removeIndex(tableName, name);
      }
    }
  },
};
