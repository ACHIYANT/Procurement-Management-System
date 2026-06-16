"use strict";

const { INDENT_TABLE, INDENT_ITEM_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn(INDENT_TABLE, "indent_no", {
      type: Sequelize.STRING(120),
      allowNull: true,
    });

    await queryInterface.changeColumn(INDENT_TABLE, "indent_date", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.changeColumn(INDENT_TABLE, "department_name", {
      type: Sequelize.STRING(160),
      allowNull: true,
    });

    await queryInterface.changeColumn(INDENT_TABLE, "received_date", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.changeColumn(INDENT_ITEM_TABLE, "item_name", {
      type: Sequelize.STRING(180),
      allowNull: true,
    });

    await queryInterface.changeColumn(INDENT_ITEM_TABLE, "quantity", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
    });

    await queryInterface.changeColumn(INDENT_ITEM_TABLE, "unit", {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `UPDATE ${INDENT_TABLE} SET indent_no = CONCAT('DRAFT-', id) WHERE indent_no IS NULL OR indent_no = ''`,
    );
    await queryInterface.sequelize.query(
      `UPDATE ${INDENT_TABLE} SET indent_date = COALESCE(indent_date, received_date, CURRENT_DATE) WHERE indent_date IS NULL`,
    );
    await queryInterface.sequelize.query(
      `UPDATE ${INDENT_TABLE} SET received_date = COALESCE(received_date, indent_date, CURRENT_DATE) WHERE received_date IS NULL`,
    );
    await queryInterface.sequelize.query(
      `UPDATE ${INDENT_TABLE} SET department_name = 'Draft Organization' WHERE department_name IS NULL OR department_name = ''`,
    );
    await queryInterface.sequelize.query(
      `UPDATE ${INDENT_ITEM_TABLE} SET item_name = CONCAT('Draft Item ', id) WHERE item_name IS NULL OR item_name = ''`,
    );
    await queryInterface.sequelize.query(
      `UPDATE ${INDENT_ITEM_TABLE} SET quantity = 0 WHERE quantity IS NULL`,
    );
    await queryInterface.sequelize.query(
      `UPDATE ${INDENT_ITEM_TABLE} SET unit = 'NA' WHERE unit IS NULL OR unit = ''`,
    );

    await queryInterface.changeColumn(INDENT_ITEM_TABLE, "unit", {
      type: Sequelize.STRING(40),
      allowNull: false,
    });

    await queryInterface.changeColumn(INDENT_ITEM_TABLE, "quantity", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
    });

    await queryInterface.changeColumn(INDENT_ITEM_TABLE, "item_name", {
      type: Sequelize.STRING(180),
      allowNull: false,
    });

    await queryInterface.changeColumn(INDENT_TABLE, "received_date", {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });

    await queryInterface.changeColumn(INDENT_TABLE, "department_name", {
      type: Sequelize.STRING(160),
      allowNull: false,
    });

    await queryInterface.changeColumn(INDENT_TABLE, "indent_date", {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });

    await queryInterface.changeColumn(INDENT_TABLE, "indent_no", {
      type: Sequelize.STRING(120),
      allowNull: false,
    });
  },
};
