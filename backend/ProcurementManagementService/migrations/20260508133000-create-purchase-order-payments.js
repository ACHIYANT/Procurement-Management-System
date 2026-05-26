"use strict";

const {
  PURCHASE_ORDER_PAYMENT_TABLE,
  PURCHASE_ORDER_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(PURCHASE_ORDER_PAYMENT_TABLE, {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      po_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: PURCHASE_ORDER_TABLE, key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      payment_stage: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      payment_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      payment_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
      },
      payment_reference_no: {
        type: Sequelize.STRING(140),
        allowNull: true,
      },
      payment_noting_path: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex(PURCHASE_ORDER_PAYMENT_TABLE, ["po_id", "payment_date"], {
      name: "purchase_order_payments_po_date_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(PURCHASE_ORDER_PAYMENT_TABLE);
  },
};
