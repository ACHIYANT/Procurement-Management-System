"use strict";

const { INDENT_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(INDENT_TABLE, "administrative_approval_document_path", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(INDENT_TABLE, "administrative_approval_document_path").catch(() => {});
  },
};
