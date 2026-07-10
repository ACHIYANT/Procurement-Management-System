"use strict";

const { INDENT_ITEM_TABLE } = require("../src/constants/table-names");

const addColumnIfMissing = async (queryInterface, tableName, columnName, definition) => {
  const table = await queryInterface.describeTable(tableName);
  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
};

const removeColumnIfPresent = async (queryInterface, tableName, columnName) => {
  const table = await queryInterface.describeTable(tableName);
  if (table[columnName]) {
    await queryInterface.removeColumn(tableName, columnName);
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, INDENT_ITEM_TABLE, "rc_package_name", {
      type: Sequelize.STRING(180),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, INDENT_ITEM_TABLE, "rc_package_limit_type", {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, INDENT_ITEM_TABLE, "rc_package_value_limit", {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, INDENT_ITEM_TABLE, "rc_package_quantity_limit", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, INDENT_ITEM_TABLE, "rc_line_role", {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, INDENT_ITEM_TABLE, "rc_line_cap_type", {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, INDENT_ITEM_TABLE, "rc_line_value_limit", {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, INDENT_ITEM_TABLE, "rc_line_quantity_limit", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await removeColumnIfPresent(queryInterface, INDENT_ITEM_TABLE, "rc_line_quantity_limit");
    await removeColumnIfPresent(queryInterface, INDENT_ITEM_TABLE, "rc_line_value_limit");
    await removeColumnIfPresent(queryInterface, INDENT_ITEM_TABLE, "rc_line_cap_type");
    await removeColumnIfPresent(queryInterface, INDENT_ITEM_TABLE, "rc_line_role");
    await removeColumnIfPresent(queryInterface, INDENT_ITEM_TABLE, "rc_package_quantity_limit");
    await removeColumnIfPresent(queryInterface, INDENT_ITEM_TABLE, "rc_package_value_limit");
    await removeColumnIfPresent(queryInterface, INDENT_ITEM_TABLE, "rc_package_limit_type");
    await removeColumnIfPresent(queryInterface, INDENT_ITEM_TABLE, "rc_package_name");
  },
};
