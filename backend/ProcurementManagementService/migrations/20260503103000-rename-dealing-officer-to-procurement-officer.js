"use strict";

const {
  INDENT_ITEM_TABLE,
  PROCUREMENT_CASE_TABLE,
} = require("../src/constants/table-names");

async function hasColumn(queryInterface, tableName, columnName) {
  const definition = await queryInterface.describeTable(tableName);
  return Object.prototype.hasOwnProperty.call(definition, columnName);
}

async function dropIndexIfExists(queryInterface, tableName, indexName) {
  try {
    await queryInterface.removeIndex(tableName, indexName);
  } catch {
    // ignore missing index
  }
}

async function addIndexIfMissing(queryInterface, tableName, fields, options) {
  try {
    await queryInterface.addIndex(tableName, fields, options);
  } catch {
    // ignore existing index
  }
}

module.exports = {
  async up(queryInterface) {
    if (await hasColumn(queryInterface, INDENT_ITEM_TABLE, "assigned_dealing_officer_id")) {
      await dropIndexIfExists(queryInterface, INDENT_ITEM_TABLE, "indent_items_dealing_officer_assignment_idx");
      await queryInterface.renameColumn(
        INDENT_ITEM_TABLE,
        "assigned_dealing_officer_id",
        "assigned_procurement_officer_id",
      );
      await addIndexIfMissing(
        queryInterface,
        INDENT_ITEM_TABLE,
        ["assigned_procurement_officer_id", "assignment_status"],
        { name: "indent_items_procurement_officer_assignment_idx" },
      );
    }

    if (await hasColumn(queryInterface, PROCUREMENT_CASE_TABLE, "dealing_officer_id")) {
      await dropIndexIfExists(queryInterface, PROCUREMENT_CASE_TABLE, "procurement_cases_dealing_officer_status_idx");
      await queryInterface.renameColumn(
        PROCUREMENT_CASE_TABLE,
        "dealing_officer_id",
        "procurement_officer_id",
      );
      await addIndexIfMissing(
        queryInterface,
        PROCUREMENT_CASE_TABLE,
        ["procurement_officer_id", "status"],
        { name: "procurement_cases_procurement_officer_status_idx" },
      );
    }
  },

  async down(queryInterface) {
    if (await hasColumn(queryInterface, INDENT_ITEM_TABLE, "assigned_procurement_officer_id")) {
      await dropIndexIfExists(queryInterface, INDENT_ITEM_TABLE, "indent_items_procurement_officer_assignment_idx");
      await queryInterface.renameColumn(
        INDENT_ITEM_TABLE,
        "assigned_procurement_officer_id",
        "assigned_dealing_officer_id",
      );
      await addIndexIfMissing(
        queryInterface,
        INDENT_ITEM_TABLE,
        ["assigned_dealing_officer_id", "assignment_status"],
        { name: "indent_items_dealing_officer_assignment_idx" },
      );
    }

    if (await hasColumn(queryInterface, PROCUREMENT_CASE_TABLE, "procurement_officer_id")) {
      await dropIndexIfExists(queryInterface, PROCUREMENT_CASE_TABLE, "procurement_cases_procurement_officer_status_idx");
      await queryInterface.renameColumn(
        PROCUREMENT_CASE_TABLE,
        "procurement_officer_id",
        "dealing_officer_id",
      );
      await addIndexIfMissing(
        queryInterface,
        PROCUREMENT_CASE_TABLE,
        ["dealing_officer_id", "status"],
        { name: "procurement_cases_dealing_officer_status_idx" },
      );
    }
  },
};
