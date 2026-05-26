"use strict";

const {
  TENDER_EXTENSION_TABLE,
  TENDER_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TENDER_EXTENSION_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      tender_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: TENDER_TABLE, key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      previous_submission_date: { type: Sequelize.DATE, allowNull: true },
      extended_upto_date: { type: Sequelize.DATE, allowNull: false },
      extension_reason: { type: Sequelize.TEXT, allowNull: true },
      approval_reference: { type: Sequelize.STRING(160), allowNull: true },
      created_by: { type: Sequelize.STRING(80), allowNull: true },
      updated_by: { type: Sequelize.STRING(80), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex(TENDER_EXTENSION_TABLE, ["tender_id", "extended_upto_date"], {
      name: "tender_submission_extensions_tender_date_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TENDER_EXTENSION_TABLE);
  },
};
