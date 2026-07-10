"use strict";

const { INDENT_TABLE } = require("../src/constants/table-names");

const resolveFinancialYearLabel = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
};

const buildSystemIndentNo = (row) => {
  const financialYear = resolveFinancialYearLabel(row.received_date || row.indent_date || row.created_at);
  if (!financialYear || !row.id) return null;
  return `PMS/${financialYear}/${String(row.id).padStart(4, "0")}`;
};

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT id, received_date, indent_date, created_at FROM ${INDENT_TABLE} WHERE status <> 'draft' ORDER BY id ASC`,
        { transaction },
      );

      if (!rows.length) return;

      await queryInterface.sequelize.query(
        `UPDATE ${INDENT_TABLE} SET system_indent_no = NULL WHERE status <> 'draft'`,
        { transaction },
      );

      for (const row of rows) {
        const systemIndentNo = buildSystemIndentNo(row);
        if (!systemIndentNo) continue;
        await queryInterface.sequelize.query(
          `UPDATE ${INDENT_TABLE} SET system_indent_no = :systemIndentNo WHERE id = :id`,
          {
            replacements: { id: row.id, systemIndentNo },
            transaction,
          },
        );
      }
    });
  },

  async down() {
    // The old count-based sequence was non-deterministic after edits/backfills, so this migration is intentionally not reversible.
  },
};
