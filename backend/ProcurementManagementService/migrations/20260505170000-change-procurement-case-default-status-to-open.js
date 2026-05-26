"use strict";

const { PROCUREMENT_CASE_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn(PROCUREMENT_CASE_TABLE, "status", {
      type: Sequelize.STRING(40),
      allowNull: false,
      defaultValue: "open",
    });

    await queryInterface.sequelize.query(
      `UPDATE ${PROCUREMENT_CASE_TABLE} SET status = 'open' WHERE status = 'draft'`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn(PROCUREMENT_CASE_TABLE, "status", {
      type: Sequelize.STRING(40),
      allowNull: false,
      defaultValue: "draft",
    });

    await queryInterface.sequelize.query(
      `UPDATE ${PROCUREMENT_CASE_TABLE} SET status = 'draft' WHERE status = 'open'`,
    );
  },
};
