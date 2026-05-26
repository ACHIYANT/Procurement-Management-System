"use strict";

const {
  FIRM_TABLE,
  PBG_TABLE,
  PURCHASE_ORDER_TABLE,
  TENDER_EMD_TABLE,
  TENDER_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex(TENDER_EMD_TABLE, ["emd_submission_status", "id"], {
      name: "tender_emd_status_cursor_idx",
    });
    await queryInterface.addIndex(TENDER_EMD_TABLE, ["refund_status", "id"], {
      name: "tender_emd_refund_cursor_idx",
    });
    await queryInterface.addIndex(TENDER_EMD_TABLE, ["finance_reference_no"], {
      name: "tender_emd_finance_ref_idx",
    });
    await queryInterface.addIndex(PBG_TABLE, ["status", "id"], {
      name: "pbg_status_cursor_idx",
    });
    await queryInterface.addIndex(PBG_TABLE, ["refund_status", "id"], {
      name: "pbg_refund_cursor_idx",
    });
    await queryInterface.addIndex(PBG_TABLE, ["bank_guarantee_no"], {
      name: "pbg_bg_no_idx",
    });
    await queryInterface.addIndex(PURCHASE_ORDER_TABLE, ["po_no"], {
      name: "purchase_orders_po_no_idx",
    });
    await queryInterface.addIndex(FIRM_TABLE, ["firm_name"], {
      name: "firms_name_idx",
    });
    await queryInterface.addIndex(TENDER_TABLE, ["tender_title"], {
      name: "tenders_title_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(TENDER_TABLE, "tenders_title_idx");
    await queryInterface.removeIndex(FIRM_TABLE, "firms_name_idx");
    await queryInterface.removeIndex(PURCHASE_ORDER_TABLE, "purchase_orders_po_no_idx");
    await queryInterface.removeIndex(PBG_TABLE, "pbg_bg_no_idx");
    await queryInterface.removeIndex(PBG_TABLE, "pbg_refund_cursor_idx");
    await queryInterface.removeIndex(PBG_TABLE, "pbg_status_cursor_idx");
    await queryInterface.removeIndex(TENDER_EMD_TABLE, "tender_emd_finance_ref_idx");
    await queryInterface.removeIndex(TENDER_EMD_TABLE, "tender_emd_refund_cursor_idx");
    await queryInterface.removeIndex(TENDER_EMD_TABLE, "tender_emd_status_cursor_idx");
  },
};
