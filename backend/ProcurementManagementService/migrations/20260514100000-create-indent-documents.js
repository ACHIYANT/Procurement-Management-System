"use strict";

const {
  INDENT_DOCUMENT_TABLE,
  INDENT_TABLE,
  PROCUREMENT_EMPLOYEE_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(INDENT_DOCUMENT_TABLE, {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      indent_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: INDENT_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      document_type: {
        type: Sequelize.STRING(80),
        allowNull: false,
        defaultValue: "supporting_document",
      },
      document_title: {
        type: Sequelize.STRING(180),
        allowNull: true,
      },
      document_path: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      uploaded_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: PROCUREMENT_EMPLOYEE_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex(INDENT_DOCUMENT_TABLE, ["indent_id", "created_at"], {
      name: "indent_documents_indent_created_at_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(INDENT_DOCUMENT_TABLE).catch(() => {});
  },
};
