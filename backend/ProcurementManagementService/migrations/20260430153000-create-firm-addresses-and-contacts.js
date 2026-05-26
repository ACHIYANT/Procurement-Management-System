"use strict";

const {
  FIRM_ADDRESS_TABLE,
  FIRM_CONTACT_TABLE,
  FIRM_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(FIRM_ADDRESS_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      firm_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: FIRM_TABLE, key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      address_type: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "office" },
      address_line_1: { type: Sequelize.STRING(255), allowNull: false },
      address_line_2: { type: Sequelize.STRING(255), allowNull: true },
      district: { type: Sequelize.STRING(120), allowNull: true },
      city: { type: Sequelize.STRING(120), allowNull: false },
      state: { type: Sequelize.STRING(120), allowNull: false },
      country: { type: Sequelize.STRING(120), allowNull: false, defaultValue: "India" },
      pin_code: { type: Sequelize.STRING(20), allowNull: true },
      landmark: { type: Sequelize.STRING(180), allowNull: true },
      is_primary: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_by: { type: Sequelize.STRING(80), allowNull: true },
      updated_by: { type: Sequelize.STRING(80), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable(FIRM_CONTACT_TABLE, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      firm_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: FIRM_TABLE, key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      contact_person_name: { type: Sequelize.STRING(160), allowNull: false },
      designation: { type: Sequelize.STRING(120), allowNull: true },
      contact_type: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "mobile" },
      contact_value: { type: Sequelize.STRING(180), allowNull: false },
      is_primary: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.STRING(80), allowNull: true },
      updated_by: { type: Sequelize.STRING(80), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex(FIRM_ADDRESS_TABLE, ["firm_id"], {
      name: "firm_addresses_firm_id_idx",
    });
    await queryInterface.addIndex(FIRM_CONTACT_TABLE, ["firm_id"], {
      name: "firm_contacts_firm_id_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(FIRM_CONTACT_TABLE);
    await queryInterface.dropTable(FIRM_ADDRESS_TABLE);
  },
};
