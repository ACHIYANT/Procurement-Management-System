"use strict";

const { TENDER_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn(TENDER_TABLE, "tender_reference_no", {
      type: Sequelize.STRING(120),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn(TENDER_TABLE, "tender_reference_no", {
      type: Sequelize.STRING(120),
      allowNull: false,
    });
  },
};
