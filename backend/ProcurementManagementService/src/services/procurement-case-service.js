"use strict";

const { Op } = require("sequelize");
const { ProcurementCaseRepository } = require("../repository/procurement-case-repository");
const ApprovalService = require("./approval-service");
const {
  asAmountNumber,
  asId,
  buildCursorResponse,
  isCursorMode,
  normalizeAmount,
  normalizeCursor,
  normalizeDate,
  normalizeLimit,
  normalizeSortBy,
  normalizeSortDirection,
  normalizeNullableText,
  normalizeText,
  notFound,
  requireValue,
} = require("../utils/procurement-domain");

const PROCUREMENT_MODES = new Set([
  "tender_gem",
  "tender_nic",
  "tender_split",
  "empanelled_vendor",
  "direct_vendor",
  "open_market",
]);

const buildProcurementCaseNo = (id) => `PC-${String(id).padStart(6, "0")}`;
const PROCUREMENT_CASE_SORT_FIELDS = [
  "id",
  "case_no",
  "title",
  "procurement_mode",
  "status",
  "estimated_value",
  "location_scope",
];

class ProcurementCaseService {
  constructor() {
    this.repository = new ProcurementCaseRepository();
    this.approvalService = new ApprovalService();
  }

  async assertApprovedProcurementCaseChangeRequest(caseId, payload = {}) {
    const approvalRequestId = payload.approval_request_id
      ? asId(payload.approval_request_id, "Approval request")
      : null;

    if (!approvalRequestId) {
      const error = new Error("Approved update request is required to edit a saved procurement case.");
      error.statusCode = 409;
      throw error;
    }

    const request = await this.approvalService.findApprovedChangeRequest({
      id: approvalRequestId,
      moduleKey: "procurementCases",
      entityType: "procurement_case",
      entityId: caseId,
    });

    if (!request) {
      const error = new Error("No approved update request is available for this procurement case.");
      error.statusCode = 403;
      throw error;
    }

    return request;
  }

  normalizeUpdatePayload(payload = {}) {
    const title = requireValue(payload, "title", "Case title");
    const procurementMode = requireValue(payload, "procurement_mode", "Procurement mode");

    if (!PROCUREMENT_MODES.has(procurementMode)) {
      const error = new Error("Procurement mode is invalid.");
      error.statusCode = 400;
      throw error;
    }

    return {
      title,
      procurement_mode: procurementMode,
      remarks: normalizeNullableText(payload.remarks),
    };
  }

  decorateCase(procurementCase) {
    if (!procurementCase) return procurementCase;

    const target = procurementCase.dataValues || procurementCase;
    const caseItems = Array.isArray(target.case_items || procurementCase.case_items)
      ? target.case_items || procurementCase.case_items
      : [];
    const tenders = Array.isArray(target.tenders || procurementCase.tenders)
      ? target.tenders || procurementCase.tenders
      : [];

    target.item_count = caseItems.length;
    target.tender_count = tenders.length;
    target.case_quantity_total = Number(
      caseItems.reduce((sum, caseItem) => sum + asAmountNumber(caseItem?.indent_item?.quantity), 0).toFixed(2),
    );
    target.case_estimated_amount_total = Number(
      caseItems.reduce((sum, caseItem) => sum + asAmountNumber(caseItem?.indent_item?.estimated_amount), 0).toFixed(2),
    );
    return procurementCase;
  }

  async decorateCaseListRows(rows = []) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return list;

    const caseIds = list.map((row) => row?.id).filter(Boolean);
    const [caseItems, tenders] = await Promise.all([
      this.repository.findCaseItemsByCaseIds(caseIds),
      this.repository.findTendersByCaseIds(caseIds),
    ]);

    const itemsByCaseId = new Map();
    for (const item of caseItems || []) {
      const caseId = Number(item?.procurement_case_id);
      if (!itemsByCaseId.has(caseId)) itemsByCaseId.set(caseId, []);
      itemsByCaseId.get(caseId).push(item);
    }

    const tendersByCaseId = new Map();
    for (const tender of tenders || []) {
      const caseId = Number(tender?.procurement_case_id);
      if (!tendersByCaseId.has(caseId)) tendersByCaseId.set(caseId, []);
      tendersByCaseId.get(caseId).push(tender);
    }

    return list.map((row) => {
      const procurementCase = typeof row?.toJSON === "function" ? row.toJSON() : { ...row };
      const caseId = Number(procurementCase.id);
      procurementCase.case_items = itemsByCaseId.get(caseId) || [];
      procurementCase.tenders = tendersByCaseId.get(caseId) || [];
      return this.decorateCase(procurementCase);
    });
  }

  async list(query = {}) {
    const search = normalizeText(query.search);
    const where = search
      ? {
          [Op.or]: [
            { case_no: { [Op.like]: `%${search}%` } },
            { title: { [Op.like]: `%${search}%` } },
            { procurement_mode: { [Op.like]: `%${search}%` } },
            { status: { [Op.like]: `%${search}%` } },
            { "$indent.indent_no$": { [Op.like]: `%${search}%` } },
          ],
        }
      : {};

    const sortBy = normalizeSortBy(query.sortBy || query.sort_by, PROCUREMENT_CASE_SORT_FIELDS, "id");
    const sortDirection = normalizeSortDirection(query.sortDir || query.sort_dir, "DESC");

    if (isCursorMode(query)) {
      const limit = normalizeLimit(query.limit);
      const cursor = normalizeCursor(query.cursor);
      const rows = await this.repository.listBase({
        where,
        cursor,
        sortBy,
        sortDirection,
        limit: limit + 1,
      });
      const response = buildCursorResponse(rows, limit, { sortBy, sortDirection });
      response.rows = await this.decorateCaseListRows(response.rows);
      return response;
    }

    return this.decorateCaseListRows(
      await this.repository.listBase({ where, limit: 100, sortBy, sortDirection }),
    );
  }

  async getById(id) {
    const procurementCase = await this.repository.findByPk(asId(id, "Procurement case id"));
    if (!procurementCase) throw notFound("Procurement case not found.");
    return this.decorateCase(procurementCase);
  }

  async create(payload = {}) {
    const indentId = asId(payload.indent_id, "Indent");
    const title = requireValue(payload, "title", "Case title");
    const procurementMode = requireValue(payload, "procurement_mode", "Procurement mode");
    const locationScope = requireValue(payload, "location_scope", "Location scope");
    const itemIds = Array.from(
      new Set((Array.isArray(payload.item_ids) ? payload.item_ids : []).map((itemId) => asId(itemId, "Indent item"))),
    );

    if (!PROCUREMENT_MODES.has(procurementMode)) {
      const error = new Error("Procurement mode is invalid.");
      error.statusCode = 400;
      throw error;
    }

    if (!itemIds.length) {
      const error = new Error("At least one indent item must be selected.");
      error.statusCode = 400;
      throw error;
    }

    const [indent, officer, items, existingLinks] = await Promise.all([
      this.repository.findIndentByPk(indentId),
      payload.procurement_officer_id
        ? this.repository.findProcurementEmployeeByPk(asId(payload.procurement_officer_id, "Procurement officer"))
        : Promise.resolve(null),
      this.repository.findIndentItemsByIds(itemIds),
      this.repository.findCaseLinksByItemIds(itemIds),
    ]);

    if (!indent) throw notFound("Indent not found.");
    if (payload.procurement_officer_id && !officer) throw notFound("Procurement officer not found.");

    if (items.length !== itemIds.length) {
      const error = new Error("One or more selected indent items were not found.");
      error.statusCode = 404;
      throw error;
    }

    const wrongIndentItem = items.find((item) => Number(item?.indent_id) !== indentId);
    if (wrongIndentItem) {
      const error = new Error("All selected items must belong to the selected indent.");
      error.statusCode = 400;
      throw error;
    }

    if (existingLinks.length) {
      const existingCaseNo = existingLinks[0]?.procurement_case?.case_no || "another procurement case";
      const error = new Error(`One or more selected items are already linked with ${existingCaseNo}.`);
      error.statusCode = 409;
      throw error;
    }

    if (officer) {
      const wrongOfficerItem = items.find(
        (item) => Number(item?.assigned_procurement_officer_id || 0) !== Number(officer.id),
      );
      if (wrongOfficerItem) {
        const error = new Error(
          "Only indent items assigned to the selected Procurement Officer can be grouped into this procurement case.",
        );
        error.statusCode = 409;
        throw error;
      }

      const currentOfficerItems = await this.repository.findCurrentOfficerIndentItems(indentId, officer.id);
      const activeOfficerItems = currentOfficerItems.filter(
        (item) => ["assigned", "reassigned"].includes(String(item?.assignment_status || "").toLowerCase()),
      );
      const missingEstimateItem = activeOfficerItems.find((item) => asAmountNumber(item?.estimated_amount) <= 0);
      if (missingEstimateItem) {
        const error = new Error(
          "Procurement case can be created only after estimated value is recorded for all items currently assigned to you under this indent.",
        );
        error.statusCode = 409;
        throw error;
      }
    }

    const procurementCase = await this.repository.withTransaction(async (transaction) => {
      const createdCase = await this.repository.createProcurementCase(
        {
          indent_id: indentId,
          case_no: `PENDING-PC-${Date.now()}`,
          title,
          procurement_officer_id: officer?.id || null,
          procurement_mode: procurementMode,
          estimated_value: payload.estimated_value === "" ? null : normalizeAmount(payload.estimated_value),
          status: normalizeText(payload.status) || "open",
          location_scope: locationScope,
          remarks: normalizeNullableText(payload.remarks),
        },
        { transaction },
      );

      await createdCase.update(
        { case_no: buildProcurementCaseNo(createdCase.id) },
        { transaction },
      );

      await this.repository.bulkCreateCaseItems(
        itemIds.map((indentItemId) => ({
          procurement_case_id: createdCase.id,
          indent_item_id: indentItemId,
          remarks: null,
        })),
        { transaction },
      );

      await this.repository.updateIndentItems(
        { id: itemIds },
        { procurement_decision_status: "case_created" },
        { transaction },
      );

      return createdCase;
    });

    return this.getById(procurementCase.id);
  }

  async update(id, payload = {}) {
    const caseId = asId(id, "Procurement case id");
    const procurementCase = await this.repository.findProcurementCaseByPk(caseId);
    if (!procurementCase) throw notFound("Procurement case not found.");

    const approvedChangeRequest = await this.assertApprovedProcurementCaseChangeRequest(
      procurementCase.id,
      payload,
    );
    const updatePayload = this.normalizeUpdatePayload(payload);

    const actorEmpcode = normalizeText(payload.actor_empcode);
    const actor = actorEmpcode
      ? await this.repository.findProcurementEmployeeByEmpcode(actorEmpcode)
      : payload.actor_employee_id
        ? await this.repository.findProcurementEmployeeByPk(asId(payload.actor_employee_id, "Actor employee"))
        : null;

    await this.repository.withTransaction(async (transaction) => {
      await this.repository.updateProcurementCase(
        procurementCase,
        {
          ...updatePayload,
          updated_by: actor?.id || null,
        },
        { transaction },
      );
    });

    await this.approvalService.markApplied(
      approvedChangeRequest.id,
      { applied_payload: updatePayload },
      {
        employee_id: actor?.id || null,
        name: normalizeNullableText(payload.actor_name) || actor?.employee_name || actorEmpcode || null,
      },
    );

    return this.getById(procurementCase.id);
  }
}

module.exports = ProcurementCaseService;
