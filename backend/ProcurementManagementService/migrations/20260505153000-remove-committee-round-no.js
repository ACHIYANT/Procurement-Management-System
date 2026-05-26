"use strict";

const { COMMITTEE_MEETING_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn(COMMITTEE_MEETING_TABLE, "round_no").catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn(COMMITTEE_MEETING_TABLE, "round_no", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    }).catch(() => {});
  },
};
