"use strict";

const { INDENT_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn(INDENT_TABLE, "cfms_no", {
      type: Sequelize.STRING(120),
      allowNull: true,
    });

    await queryInterface.addColumn(INDENT_TABLE, "specification_document_path", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.addColumn(INDENT_TABLE, "administrative_approval_remarks", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn(INDENT_TABLE, "administrative_approval_remarks").catch(() => {});
    await queryInterface.removeColumn(INDENT_TABLE, "specification_document_path").catch(() => {});

    await queryInterface.changeColumn(INDENT_TABLE, "cfms_no", {
      type: Sequelize.STRING(120),
      allowNull: false,
    });
  },
};
