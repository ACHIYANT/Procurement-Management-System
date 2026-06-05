"use strict";

const { QueryTypes } = require("sequelize");
const { INDENT_TABLE } = require("../src/constants/table-names");

const resolveFinancialYear = (dateValue) => {
  const date = new Date(dateValue || Date.now());
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return {
    label: `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`,
    key: `${startYear}-${endYear}`,
  };
};

module.exports = {
  async up(queryInterface) {
    const rows = await queryInterface.sequelize.query(
      `SELECT id, received_date FROM ${INDENT_TABLE} WHERE system_indent_no IS NULL ORDER BY received_date ASC, id ASC`,
      { type: QueryTypes.SELECT },
    );

    const sequenceByFy = new Map();
    for (const row of rows) {
      const fy = resolveFinancialYear(row.received_date);
      const nextSequence = (sequenceByFy.get(fy.key) || 0) + 1;
      sequenceByFy.set(fy.key, nextSequence);
      const systemIndentNo = `PMS/${fy.label}/${String(nextSequence).padStart(4, "0")}`;
      await queryInterface.sequelize.query(
        `UPDATE ${INDENT_TABLE} SET system_indent_no = :systemIndentNo WHERE id = :id`,
        {
          replacements: { systemIndentNo, id: row.id },
        },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE ${INDENT_TABLE} SET system_indent_no = NULL`,
    );
  },
};
