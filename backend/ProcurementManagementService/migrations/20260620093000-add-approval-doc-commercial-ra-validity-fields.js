"use strict";

const {
  INDENT_DOCUMENT_TABLE,
  INDENT_ITEM_TABLE,
  TENDER_TABLE,
  TENDER_VENDOR_ITEM_QUOTE_TABLE,
  TENDER_VENDOR_TABLE,
} = require("../src/constants/table-names");

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
    await addColumnIfMissing(queryInterface, INDENT_ITEM_TABLE, "administrative_approval_status", {
      type: Sequelize.STRING(40),
      allowNull: false,
      defaultValue: "not_required",
    });

    await addColumnIfMissing(queryInterface, INDENT_DOCUMENT_TABLE, "communication_direction", {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, INDENT_DOCUMENT_TABLE, "reference_no", {
      type: Sequelize.STRING(160),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, INDENT_DOCUMENT_TABLE, "reference_date", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, TENDER_TABLE, "price_bid_valid_upto", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, TENDER_TABLE, "technical_bid_validity_applicable", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing(queryInterface, TENDER_TABLE, "technical_bid_valid_upto", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, TENDER_TABLE, "ra_start_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, TENDER_TABLE, "ra_end_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, TENDER_TABLE, "ra_remarks", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, TENDER_VENDOR_TABLE, "commercial_bid_document_path", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, TENDER_VENDOR_ITEM_QUOTE_TABLE, "pre_ra_amount", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, TENDER_VENDOR_ITEM_QUOTE_TABLE, "post_ra_amount", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await removeColumnIfPresent(queryInterface, TENDER_VENDOR_ITEM_QUOTE_TABLE, "post_ra_amount");
    await removeColumnIfPresent(queryInterface, TENDER_VENDOR_ITEM_QUOTE_TABLE, "pre_ra_amount");
    await removeColumnIfPresent(queryInterface, TENDER_VENDOR_TABLE, "commercial_bid_document_path");
    await removeColumnIfPresent(queryInterface, TENDER_TABLE, "ra_remarks");
    await removeColumnIfPresent(queryInterface, TENDER_TABLE, "ra_end_at");
    await removeColumnIfPresent(queryInterface, TENDER_TABLE, "ra_start_at");
    await removeColumnIfPresent(queryInterface, TENDER_TABLE, "technical_bid_valid_upto");
    await removeColumnIfPresent(queryInterface, TENDER_TABLE, "technical_bid_validity_applicable");
    await removeColumnIfPresent(queryInterface, TENDER_TABLE, "price_bid_valid_upto");
    await removeColumnIfPresent(queryInterface, INDENT_DOCUMENT_TABLE, "reference_date");
    await removeColumnIfPresent(queryInterface, INDENT_DOCUMENT_TABLE, "reference_no");
    await removeColumnIfPresent(queryInterface, INDENT_DOCUMENT_TABLE, "communication_direction");
    await removeColumnIfPresent(queryInterface, INDENT_ITEM_TABLE, "administrative_approval_status");
  },
};
