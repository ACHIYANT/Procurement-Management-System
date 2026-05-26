"use strict";

const {
  TENDER_TABLE,
  TENDER_VENDOR_TABLE,
  FIRM_TABLE,
  PURCHASE_ORDER_TABLE,
  PBG_TABLE,
  TENDER_PBG_SETUP_TABLE,
  PBG_OBLIGATION_TABLE,
  PBG_RECEIPT_ALLOCATION_TABLE,
} = require("../src/constants/table-names");

const tableExists = async (queryInterface, tableName) => {
  const tables = await queryInterface.showAllTables();
  return tables.includes(tableName);
};

const addColumnIfMissing = async (queryInterface, tableName, columnName, definition) => {
  const table = await queryInterface.describeTable(tableName);
  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, TENDER_PBG_SETUP_TABLE))) {
      await queryInterface.createTable(TENDER_PBG_SETUP_TABLE, {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        tender_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          unique: true,
          references: { model: TENDER_TABLE, key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        pbg_mode: {
          type: Sequelize.STRING(40),
          allowNull: false,
          defaultValue: "po_wise",
        },
        default_pbg_percentage: {
          type: Sequelize.DECIMAL(5, 2),
          allowNull: true,
        },
        additional_claim_months: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 6,
        },
        additional_claim_days: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        warning_before_days: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 30,
        },
        remarks: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        created_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        updated_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      });
    }

    if (!(await tableExists(queryInterface, PBG_OBLIGATION_TABLE))) {
      await queryInterface.createTable(PBG_OBLIGATION_TABLE, {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        tender_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: TENDER_TABLE, key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        tender_vendor_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: TENDER_VENDOR_TABLE, key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        firm_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: FIRM_TABLE, key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        purchase_order_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: PURCHASE_ORDER_TABLE, key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        obligation_type: {
          type: Sequelize.STRING(40),
          allowNull: false,
        },
        coverage_mode: {
          type: Sequelize.STRING(60),
          allowNull: false,
        },
        reference_value: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: true,
        },
        pbg_percentage: {
          type: Sequelize.DECIMAL(5, 2),
          allowNull: true,
        },
        required_amount: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0,
        },
        required_valid_upto_provisional: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
        required_valid_upto_final: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
        warranty_anchor_date: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
        additional_claim_upto: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
        source_reference: {
          type: Sequelize.STRING(180),
          allowNull: true,
        },
        source_reference_date: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
        extension_reference_no: {
          type: Sequelize.STRING(180),
          allowNull: true,
        },
        extension_reference_date: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
        extension_document_path: {
          type: Sequelize.STRING(500),
          allowNull: true,
        },
        status: {
          type: Sequelize.STRING(40),
          allowNull: false,
          defaultValue: "active",
        },
        remarks: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        created_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        updated_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      });
      await queryInterface.addIndex(PBG_OBLIGATION_TABLE, ["tender_id", "firm_id"], {
        name: "pbg_obligations_tender_firm_idx",
      });
      await queryInterface.addIndex(PBG_OBLIGATION_TABLE, ["purchase_order_id"], {
        name: "pbg_obligations_po_idx",
      });
    }

    await addColumnIfMissing(queryInterface, PBG_TABLE, "tender_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: TENDER_TABLE, key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    await addColumnIfMissing(queryInterface, PBG_TABLE, "invocation_upto", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    const pbgTable = await queryInterface.describeTable(PBG_TABLE);
    if (pbgTable.po_id && pbgTable.po_id.allowNull === false) {
      await queryInterface.removeConstraint(PBG_TABLE, "pbg_entries_ibfk_3").catch(
        () => {},
      );
      await queryInterface.removeConstraint(PBG_TABLE, "pbg_entries_po_fk").catch(
        () => {},
      );
      await queryInterface.changeColumn(PBG_TABLE, "po_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
      await queryInterface.addConstraint(PBG_TABLE, {
        fields: ["po_id"],
        type: "foreign key",
        name: "pbg_entries_po_fk",
        references: {
          table: PURCHASE_ORDER_TABLE,
          field: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }

    if (!(await tableExists(queryInterface, PBG_RECEIPT_ALLOCATION_TABLE))) {
      await queryInterface.createTable(PBG_RECEIPT_ALLOCATION_TABLE, {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        pbg_entry_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: PBG_TABLE, key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        pbg_obligation_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: PBG_OBLIGATION_TABLE, key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        allocated_amount: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0,
        },
        created_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        updated_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      });
      await queryInterface.addIndex(PBG_RECEIPT_ALLOCATION_TABLE, ["pbg_entry_id"], {
        name: "pbg_receipt_allocations_entry_idx",
      });
      await queryInterface.addIndex(PBG_RECEIPT_ALLOCATION_TABLE, ["pbg_obligation_id"], {
        name: "pbg_receipt_allocations_obligation_idx",
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable(PBG_RECEIPT_ALLOCATION_TABLE).catch(() => {});
    await queryInterface.removeColumn(PBG_TABLE, "invocation_upto").catch(() => {});
    await queryInterface.removeColumn(PBG_TABLE, "tender_id").catch(() => {});
    await queryInterface.dropTable(PBG_OBLIGATION_TABLE).catch(() => {});
    await queryInterface.dropTable(TENDER_PBG_SETUP_TABLE).catch(() => {});
  },
};
