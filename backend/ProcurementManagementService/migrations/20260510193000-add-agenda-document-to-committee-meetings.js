"use strict";

const { COMMITTEE_MEETING_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(COMMITTEE_MEETING_TABLE, "agenda_document_path", {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: "agenda",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(COMMITTEE_MEETING_TABLE, "agenda_document_path");
  },
};
