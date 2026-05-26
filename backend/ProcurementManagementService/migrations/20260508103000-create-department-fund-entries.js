"use strict";

const {
  DEPARTMENT_FUND_TABLE,
  INDENT_TABLE,
  PURCHASE_ORDER_TABLE,
  TENDER_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(DEPARTMENT_FUND_TABLE, {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      department_name: { type: Sequelize.STRING(180), allowNull: false },
      subject: { type: Sequelize.STRING(250), allowNull: false },
      entry_type: {
        type: Sequelize.STRING(40),
        allowNull: false,
      },
      entry_origin: {
        type: Sequelize.STRING(60),
        allowNull: false,
        defaultValue: "department_funds",
      },
      amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      entry_date: { type: Sequelize.DATEONLY, allowNull: false },
      reference_no: { type: Sequelize.STRING(140), allowNull: true },
      financial_year: { type: Sequelize.STRING(20), allowNull: true },
      estimate_reference: { type: Sequelize.STRING(140), allowNull: true },
      estimate_date: { type: Sequelize.DATEONLY, allowNull: true },
      estimate_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      indent_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: INDENT_TABLE, key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      tender_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: TENDER_TABLE, key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      po_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: PURCHASE_ORDER_TABLE, key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      noting_page_path: { type: Sequelize.STRING(500), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      location_scope: {
        type: Sequelize.STRING(80),
        allowNull: false,
        defaultValue: "PANCHKULA",
      },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex(DEPARTMENT_FUND_TABLE, ["department_name", "entry_date"], {
      name: "department_fund_entries_department_date_idx",
    });
    await queryInterface.addIndex(DEPARTMENT_FUND_TABLE, ["entry_origin", "entry_type"], {
      name: "department_fund_entries_origin_type_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(DEPARTMENT_FUND_TABLE);
  },
};
