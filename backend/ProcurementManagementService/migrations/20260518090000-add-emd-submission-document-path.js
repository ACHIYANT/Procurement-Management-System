"use strict";

const { TENDER_EMD_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable(TENDER_EMD_TABLE);
    if (!table.submission_document_path) {
      await queryInterface.addColumn(TENDER_EMD_TABLE, "submission_document_path", {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable(TENDER_EMD_TABLE);
    if (table.submission_document_path) {
      await queryInterface.removeColumn(TENDER_EMD_TABLE, "submission_document_path");
    }
  },
};
