"use strict";

const { INDENT_TABLE, INDENT_ITEM_TABLE } = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(INDENT_TABLE, "cfms_no", {
      type: Sequelize.STRING(120),
      allowNull: true,
    });

    await queryInterface.addColumn(INDENT_TABLE, "received_date", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.addColumn(INDENT_ITEM_TABLE, "administrative_approval_required", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.renameColumn(INDENT_ITEM_TABLE, "brand_preference", "preferred_make");

    await queryInterface.sequelize.query(
      `UPDATE ${INDENT_TABLE} SET cfms_no = COALESCE(cfms_no, CONCAT('CFMS-', id)), received_date = COALESCE(received_date, indent_date), status = COALESCE(status, 'received')`,
    );

    await queryInterface.changeColumn(INDENT_TABLE, "cfms_no", {
      type: Sequelize.STRING(120),
      allowNull: false,
    });

    await queryInterface.changeColumn(INDENT_TABLE, "received_date", {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });

    await queryInterface.changeColumn(INDENT_TABLE, "status", {
      type: Sequelize.STRING(40),
      allowNull: false,
      defaultValue: "received",
    });

    await queryInterface.removeColumn(INDENT_TABLE, "requested_by_name");
    await queryInterface.removeColumn(INDENT_TABLE, "requested_by_empcode");
    await queryInterface.removeColumn(INDENT_TABLE, "justification");
    await queryInterface.removeColumn(INDENT_TABLE, "estimated_value");
    await queryInterface.removeColumn(INDENT_TABLE, "specification_notes");
    await queryInterface.removeColumn(INDENT_TABLE, "approval_status");
    await queryInterface.removeColumn(INDENT_TABLE, "approval_date");

    await queryInterface.addIndex(INDENT_TABLE, ["cfms_no"], {
      name: "indents_cfms_no_idx",
    });
    await queryInterface.addIndex(INDENT_TABLE, ["received_date"], {
      name: "indents_received_date_idx",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn(INDENT_TABLE, "requested_by_name", {
      type: Sequelize.STRING(160),
      allowNull: true,
    });
    await queryInterface.addColumn(INDENT_TABLE, "requested_by_empcode", {
      type: Sequelize.STRING(80),
      allowNull: true,
    });
    await queryInterface.addColumn(INDENT_TABLE, "justification", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn(INDENT_TABLE, "estimated_value", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
    });
    await queryInterface.addColumn(INDENT_TABLE, "specification_notes", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn(INDENT_TABLE, "approval_status", {
      type: Sequelize.STRING(40),
      allowNull: false,
      defaultValue: "pending",
    });
    await queryInterface.addColumn(INDENT_TABLE, "approval_date", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.renameColumn(INDENT_ITEM_TABLE, "preferred_make", "brand_preference");
    await queryInterface.removeColumn(INDENT_ITEM_TABLE, "administrative_approval_required");
    await queryInterface.removeColumn(INDENT_TABLE, "cfms_no");
    await queryInterface.removeColumn(INDENT_TABLE, "received_date");
  },
};
