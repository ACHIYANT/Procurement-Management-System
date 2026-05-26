"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("tenders", "bid_submission_date", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.changeColumn("tenders", "current_submission_deadline", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.changeColumn(
      "tender_submission_extensions",
      "previous_submission_date",
      {
        type: Sequelize.DATE,
        allowNull: true,
      },
    );

    await queryInterface.changeColumn(
      "tender_submission_extensions",
      "extended_upto_date",
      {
        type: Sequelize.DATE,
        allowNull: false,
      },
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("tenders", "bid_submission_date", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.changeColumn("tenders", "current_submission_deadline", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.changeColumn(
      "tender_submission_extensions",
      "previous_submission_date",
      {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
    );

    await queryInterface.changeColumn(
      "tender_submission_extensions",
      "extended_upto_date",
      {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
    );
  },
};
