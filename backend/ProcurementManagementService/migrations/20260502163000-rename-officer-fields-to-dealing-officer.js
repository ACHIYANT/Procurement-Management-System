"use strict";

const { INDENT_ITEM_TABLE, PROCUREMENT_CASE_TABLE } = require("../src/constants/table-names");

const hasColumn = async (queryInterface, tableName, columnName) => {
  const definition = await queryInterface.describeTable(tableName);
  return Boolean(definition?.[columnName]);
};

const dropIndexIfExists = async (queryInterface, tableName, indexName) => {
  try {
    await queryInterface.removeIndex(tableName, indexName);
  } catch {
    // ignore missing index
  }
};

const addIndexIfMissing = async (queryInterface, tableName, columns, options) => {
  try {
    await queryInterface.addIndex(tableName, columns, options);
  } catch {
    // ignore duplicate index creation
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    if (await hasColumn(queryInterface, INDENT_ITEM_TABLE, "assigned_procurement_officer_id")) {
      await dropIndexIfExists(queryInterface, INDENT_ITEM_TABLE, "indent_items_officer_assignment_idx");
      await queryInterface.renameColumn(
        INDENT_ITEM_TABLE,
        "assigned_procurement_officer_id",
        "assigned_dealing_officer_id",
      );
    }

    if (await hasColumn(queryInterface, PROCUREMENT_CASE_TABLE, "procurement_officer_id")) {
      await dropIndexIfExists(queryInterface, PROCUREMENT_CASE_TABLE, "procurement_cases_officer_status_idx");
      await queryInterface.renameColumn(
        PROCUREMENT_CASE_TABLE,
        "procurement_officer_id",
        "dealing_officer_id",
      );
    }

    const indentItemDefinition = await queryInterface.describeTable(INDENT_ITEM_TABLE);
    if (indentItemDefinition?.assigned_dealing_officer_id) {
      await addIndexIfMissing(queryInterface, INDENT_ITEM_TABLE, ["assigned_dealing_officer_id", "assignment_status"], {
        name: "indent_items_dealing_officer_assignment_idx",
      });
    }

    const procurementCaseDefinition = await queryInterface.describeTable(PROCUREMENT_CASE_TABLE);
    if (procurementCaseDefinition?.dealing_officer_id) {
      await addIndexIfMissing(queryInterface, PROCUREMENT_CASE_TABLE, ["dealing_officer_id", "status"], {
        name: "procurement_cases_dealing_officer_status_idx",
      });
    }
  },

  async down(queryInterface) {
    if (await hasColumn(queryInterface, INDENT_ITEM_TABLE, "assigned_dealing_officer_id")) {
      await dropIndexIfExists(queryInterface, INDENT_ITEM_TABLE, "indent_items_dealing_officer_assignment_idx");
      await queryInterface.renameColumn(
        INDENT_ITEM_TABLE,
        "assigned_dealing_officer_id",
        "assigned_procurement_officer_id",
      );
      await addIndexIfMissing(queryInterface, INDENT_ITEM_TABLE, ["assigned_procurement_officer_id", "assignment_status"], {
        name: "indent_items_officer_assignment_idx",
      });
    }

    if (await hasColumn(queryInterface, PROCUREMENT_CASE_TABLE, "dealing_officer_id")) {
      await dropIndexIfExists(queryInterface, PROCUREMENT_CASE_TABLE, "procurement_cases_dealing_officer_status_idx");
      await queryInterface.renameColumn(
        PROCUREMENT_CASE_TABLE,
        "dealing_officer_id",
        "procurement_officer_id",
      );
      await addIndexIfMissing(queryInterface, PROCUREMENT_CASE_TABLE, ["procurement_officer_id", "status"], {
        name: "procurement_cases_officer_status_idx",
      });
    }
  },
};
