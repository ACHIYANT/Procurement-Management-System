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

const organizationCode = (value) => {
  const words = String(value || "ORG")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, 3).map((word) => word[0]).join("") || "ORG";
};

const locationCode = (value) =>
  String(value || "PMS").replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase() || "PMS";

module.exports = {
  async up(queryInterface) {
    const rows = await queryInterface.sequelize.query(
      `SELECT id, received_date, department_name, location_scope FROM ${INDENT_TABLE} WHERE system_indent_no IS NULL ORDER BY received_date ASC, id ASC`,
      { type: QueryTypes.SELECT },
    );

    const sequenceByFy = new Map();
    for (const row of rows) {
      const fy = resolveFinancialYear(row.received_date);
      const nextSequence = (sequenceByFy.get(fy.key) || 0) + 1;
      sequenceByFy.set(fy.key, nextSequence);
      const systemIndentNo = `PMS/${locationCode(row.location_scope)}/${organizationCode(row.department_name)}/${fy.label}/${String(nextSequence).padStart(4, "0")}`;
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
