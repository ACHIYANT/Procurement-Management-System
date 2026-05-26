"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("tender_vendors", "technical_status_updated_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("tender_vendors", "commercial_status_updated_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("tender_vendors", "commercial_status_updated_at");
    await queryInterface.removeColumn("tender_vendors", "technical_status_updated_at");
  },
};
