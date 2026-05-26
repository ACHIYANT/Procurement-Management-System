"use strict";

const { USER_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(USER_TABLE, {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      empcode: {
        type: Sequelize.STRING(30),
        allowNull: false,
        unique: true,
      },
      fullname: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      mobileno: {
        type: Sequelize.STRING(10),
        allowNull: false,
        unique: true,
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      designation: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      department: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      location_scope: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      must_change_password: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      password_version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      password_changed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable(USER_TABLE);
  },
};
