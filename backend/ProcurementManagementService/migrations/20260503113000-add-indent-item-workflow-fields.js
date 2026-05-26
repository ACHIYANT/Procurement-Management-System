"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("indent_items", "assigned_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("indent_items", "return_reason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("indent_items", "returned_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("indent_items", "estimated_by_procurement_officer_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "procurement_employees",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("indent_items", "estimated_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("indent_items", "estimated_at");
    await queryInterface.removeColumn("indent_items", "estimated_by_procurement_officer_id");
    await queryInterface.removeColumn("indent_items", "returned_at");
    await queryInterface.removeColumn("indent_items", "return_reason");
    await queryInterface.removeColumn("indent_items", "assigned_at");
  },
};
