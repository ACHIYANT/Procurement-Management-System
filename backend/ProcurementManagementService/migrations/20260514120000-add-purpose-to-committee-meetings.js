"use strict";

const { COMMITTEE_MEETING_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(COMMITTEE_MEETING_TABLE, "purpose", {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: "meeting_type",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(COMMITTEE_MEETING_TABLE, "purpose").catch(() => {});
  },
};
