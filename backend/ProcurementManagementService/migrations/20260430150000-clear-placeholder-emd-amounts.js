"use strict";

const { TENDER_EMD_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkUpdate(
      TENDER_EMD_TABLE,
      {
        emd_amount: null,
      },
      {
        emd_submission_status: "not_submitted",
      },
    );
  },

  async down(queryInterface, Sequelize) {
    return Promise.resolve();
  },
};
