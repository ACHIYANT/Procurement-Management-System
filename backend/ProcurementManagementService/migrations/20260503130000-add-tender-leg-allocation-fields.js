"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("tenders", "leg_label", {
      type: Sequelize.STRING(120),
      allowNull: true,
    });

    await queryInterface.addColumn("tenders", "allocation_quantity", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("tenders", "allocation_quantity");
    await queryInterface.removeColumn("tenders", "leg_label");
  },
};
