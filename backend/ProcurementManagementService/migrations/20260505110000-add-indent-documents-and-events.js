"use strict";

const {
  INDENT_ITEM_EVENT_TABLE,
  INDENT_ITEM_TABLE,
  INDENT_TABLE,
  PROCUREMENT_EMPLOYEE_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(INDENT_TABLE, "indent_document_path", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.addColumn(INDENT_ITEM_TABLE, "specific_make_required", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn(INDENT_ITEM_TABLE, "administrative_approval_document_path", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.changeColumn(INDENT_ITEM_TABLE, "specification", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.createTable(INDENT_ITEM_EVENT_TABLE, {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      indent_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: INDENT_ITEM_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      event_type: { type: Sequelize.STRING(60), allowNull: false },
      event_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      actor_procurement_employee_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: PROCUREMENT_EMPLOYEE_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      from_procurement_officer_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: PROCUREMENT_EMPLOYEE_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      to_procurement_officer_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: PROCUREMENT_EMPLOYEE_TABLE, key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      details: { type: Sequelize.TEXT, allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });

    await queryInterface.addIndex(INDENT_ITEM_EVENT_TABLE, ["indent_item_id", "event_at"], {
      name: "indent_item_events_indent_item_event_at_idx",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex(INDENT_ITEM_EVENT_TABLE, "indent_item_events_indent_item_event_at_idx").catch(() => {});
    await queryInterface.dropTable(INDENT_ITEM_EVENT_TABLE).catch(() => {});

    await queryInterface.changeColumn(INDENT_ITEM_TABLE, "specification", {
      type: Sequelize.TEXT,
      allowNull: false,
    });

    await queryInterface.removeColumn(INDENT_ITEM_TABLE, "administrative_approval_document_path").catch(() => {});
    await queryInterface.removeColumn(INDENT_ITEM_TABLE, "specific_make_required").catch(() => {});
    await queryInterface.removeColumn(INDENT_TABLE, "indent_document_path").catch(() => {});
  },
};
