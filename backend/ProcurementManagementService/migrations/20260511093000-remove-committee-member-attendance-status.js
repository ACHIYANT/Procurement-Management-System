"use strict";

const { COMMITTEE_MEMBER_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn(COMMITTEE_MEMBER_TABLE, "attendance_status");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn(COMMITTEE_MEMBER_TABLE, "attendance_status", {
      type: Sequelize.STRING(30),
      allowNull: false,
      defaultValue: "present",
    });
  },
};
