"use strict";

const { WORK_TASK_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(WORK_TASK_TABLE, "reminder_frequency", {
      type: Sequelize.STRING(40),
      allowNull: false,
      defaultValue: "once",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(WORK_TASK_TABLE, "reminder_frequency");
  },
};
