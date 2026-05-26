"use strict";

const {
  ROLE_TABLE,
  USER_ROLE_TABLE,
  USER_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(USER_ROLE_TABLE, {
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: USER_TABLE,
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      role_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: ROLE_TABLE,
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
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

    await queryInterface.addConstraint(USER_ROLE_TABLE, {
      fields: ["user_id", "role_id"],
      type: "primary key",
      name: "pk_user_roles",
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable(USER_ROLE_TABLE);
  },
};
