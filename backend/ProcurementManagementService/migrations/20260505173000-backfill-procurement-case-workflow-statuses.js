"use strict";

const {
  PROCUREMENT_CASE_TABLE,
  TENDER_TABLE,
  COMMITTEE_MEETING_TABLE,
  PURCHASE_ORDER_TABLE,
} = require("../src/constants/table-names");

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;

    await sequelize.query(`
      UPDATE ${PROCUREMENT_CASE_TABLE}
      SET status = 'open'
      WHERE status = 'draft'
    `);

    await sequelize.query(`
      UPDATE ${PROCUREMENT_CASE_TABLE} pc
      SET pc.status = 'tender_created'
      WHERE pc.status NOT IN ('completed', 'cancelled', 'po_created', 'under_process')
        AND EXISTS (
          SELECT 1
          FROM ${TENDER_TABLE} t
          WHERE t.procurement_case_id = pc.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM ${COMMITTEE_MEETING_TABLE} cm
          WHERE cm.procurement_case_id = pc.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM ${TENDER_TABLE} t2
          INNER JOIN ${PURCHASE_ORDER_TABLE} po ON po.tender_id = t2.id
          WHERE t2.procurement_case_id = pc.id
        )
    `);

    await sequelize.query(`
      UPDATE ${PROCUREMENT_CASE_TABLE} pc
      SET pc.status = 'under_process'
      WHERE pc.status NOT IN ('completed', 'cancelled', 'po_created')
        AND EXISTS (
          SELECT 1
          FROM ${TENDER_TABLE} t
          WHERE t.procurement_case_id = pc.id
        )
        AND EXISTS (
          SELECT 1
          FROM ${COMMITTEE_MEETING_TABLE} cm
          WHERE cm.procurement_case_id = pc.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM ${TENDER_TABLE} t2
          INNER JOIN ${PURCHASE_ORDER_TABLE} po ON po.tender_id = t2.id
          WHERE t2.procurement_case_id = pc.id
        )
    `);

    await sequelize.query(`
      UPDATE ${PROCUREMENT_CASE_TABLE} pc
      SET pc.status = 'po_created'
      WHERE pc.status NOT IN ('completed', 'cancelled')
        AND EXISTS (
          SELECT 1
          FROM ${TENDER_TABLE} t
          INNER JOIN ${PURCHASE_ORDER_TABLE} po ON po.tender_id = t.id
          WHERE t.procurement_case_id = pc.id
        )
    `);
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;

    await sequelize.query(`
      UPDATE ${PROCUREMENT_CASE_TABLE}
      SET status = 'open'
      WHERE status IN ('tender_created', 'under_process', 'po_created')
    `);
  },
};
