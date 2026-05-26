"use strict";

const {
  PROCUREMENT_EMPLOYEE_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(PROCUREMENT_EMPLOYEE_TABLE, {
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
      employee_name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      mobile_no: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      designation: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      assigned_roles: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "[]",
      },
      division: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      location_scope: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.addIndex(PROCUREMENT_EMPLOYEE_TABLE, ["empcode"], {
      unique: true,
      name: "procurement_employees_empcode_unique",
    });
    await queryInterface.addIndex(PROCUREMENT_EMPLOYEE_TABLE, ["mobile_no"], {
      name: "procurement_employees_mobile_idx",
    });
    await queryInterface.addIndex(PROCUREMENT_EMPLOYEE_TABLE, ["location_scope"], {
      name: "procurement_employees_location_scope_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(PROCUREMENT_EMPLOYEE_TABLE);
  },
};
