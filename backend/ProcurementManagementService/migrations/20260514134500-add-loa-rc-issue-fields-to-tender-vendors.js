"use strict";

const { TENDER_VENDOR_TABLE } = require("../src/constants/table-names");

const addColumnIfMissing = async (queryInterface, tableName, columnName, definition) => {
  const table = await queryInterface.describeTable(tableName);
  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
};

const removeColumnIfPresent = async (queryInterface, tableName, columnName) => {
  const table = await queryInterface.describeTable(tableName);
  if (table[columnName]) {
    await queryInterface.removeColumn(tableName, columnName);
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, TENDER_VENDOR_TABLE, "loa_rc_issue_type", {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, TENDER_VENDOR_TABLE, "loa_rc_issue_date", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, TENDER_VENDOR_TABLE, "loa_rc_document_path", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await removeColumnIfPresent(queryInterface, TENDER_VENDOR_TABLE, "loa_rc_document_path");
    await removeColumnIfPresent(queryInterface, TENDER_VENDOR_TABLE, "loa_rc_issue_date");
    await removeColumnIfPresent(queryInterface, TENDER_VENDOR_TABLE, "loa_rc_issue_type");
  },
};
