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
    await addColumnIfMissing(queryInterface, INDENT_ITEM_TABLE, "contract_quantity_limit", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, INDENT_ITEM_TABLE, "contract_extension_allowed", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing(queryInterface, INDENT_ITEM_TABLE, "contract_extension_type", {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, INDENT_ITEM_TABLE, "contract_extension_value", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, INDENT_ITEM_TABLE, "contract_extension_unit", {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await removeColumnIfPresent(queryInterface, INDENT_ITEM_TABLE, "contract_extension_unit");
    await removeColumnIfPresent(queryInterface, INDENT_ITEM_TABLE, "contract_extension_value");
    await removeColumnIfPresent(queryInterface, INDENT_ITEM_TABLE, "contract_extension_type");
    await removeColumnIfPresent(queryInterface, INDENT_ITEM_TABLE, "contract_extension_allowed");
    await removeColumnIfPresent(queryInterface, INDENT_ITEM_TABLE, "contract_quantity_limit");
  },
};
