"use strict";

module.exports = {
  async up(queryInterface) {
    const table = await queryInterface.describeTable("tenders");
    if (table.allocation_percentage) {
      await queryInterface.removeColumn("tenders", "allocation_percentage");
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("tenders");
    if (!table.allocation_percentage) {
      await queryInterface.addColumn("tenders", "allocation_percentage", {
        type: Sequelize.DECIMAL(7, 2),
        allowNull: true,
      });
    }
  },
};
