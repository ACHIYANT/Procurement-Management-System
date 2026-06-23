"use strict";

const { Op } = require("sequelize");
const { IndentRepository } = require("../repository/indent-repository");
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
  normalizeNullableDate,
  normalizeSortBy,
  normalizeSortDirection,
  normalizeNullableText,
  normalizeText,
  notFound,
  requireDate,
  requireValue,
} = require("../utils/procurement-domain");

const INDENT_SORT_FIELDS = [
  "id",
  "system_indent_no",
  "indent_no",
  "indent_date",
  "cfms_no",
  "received_date",
  "department_name",
  "status",
  "location_scope",
];
const ADMINISTRATIVE_APPROVAL_THRESHOLD = 10000000;
const ADMINISTRATIVE_APPROVAL_STATUSES = new Set([
  "required",
  "not_required",
  "auto_required",
]);

class IndentService {
  constructor() {
    this.repository = new IndentRepository();
    this.approvalService = new ApprovalService();
  }

  normalizeYesNoBoolean(value) {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (["yes", "true", "1"].includes(normalized)) return true;
    if (["no", "false", "0", ""].includes(normalized)) return false;
    return Boolean(value);
  }

  normalizeAdministrativeApprovalStatus(item = {}) {
    const estimatedAmount = asAmountNumber(
      item?.estimated_amount ?? item?.estimated_value ?? item?.item_value,
    );
    if (estimatedAmount >= ADMINISTRATIVE_APPROVAL_THRESHOLD) {
      return "auto_required";
    }

    const requestedStatus = normalizeText(item?.administrative_approval_status);
    if (ADMINISTRATIVE_APPROVAL_STATUSES.has(requestedStatus)) {
      return requestedStatus === "auto_required" ? "required" : requestedStatus;
    }

    return this.normalizeYesNoBoolean(item?.administrative_approval_required)
      ? "required"
      : "not_required";
  }

  normalizeRoleNames(value) {
    const rawRoles = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(",")
        : [];

    return Array.from(
      new Set(
        rawRoles
          .map((role) => normalizeText(role).toUpperCase())
          .filter(Boolean),
      ),
    );
  }

  isDraftPayload(payload = {}) {
    const status = String(payload.status || "").trim().toLowerCase();
    return payload.save_as_draft === true || status === "draft";
  }

  getCurrentStatus(value) {
    return String(value || "").trim().toLowerCase();
  }

  buildIndentPayload(payload = {}, { draft = false } = {}) {
    return {
      indent_no: draft
        ? normalizeNullableText(payload.indent_no)
        : requireValue(payload, "indent_no", "Indent number"),
      indent_date: draft
        ? normalizeNullableDate(payload.indent_date)
        : requireDate(payload, "indent_date", "Indent date"),
      department_name: draft
        ? normalizeNullableText(payload.department_name)
        : requireValue(payload, "department_name", "Indenting organization"),
      cfms_no: normalizeNullableText(payload.cfms_no),
      received_date: draft
        ? normalizeNullableDate(payload.received_date)
        : requireDate(payload, "received_date", "Received date"),
      location_scope: draft
        ? normalizeText(payload.location_scope) || "PANCHKULA"
        : requireValue(payload, "location_scope", "Location scope"),
      indent_document_path: normalizeNullableText(payload.indent_document_path),
      specification_document_path: normalizeNullableText(payload.specification_document_path),
      administrative_approval_document_path: normalizeNullableText(payload.administrative_approval_document_path),
      administrative_approval_remarks: normalizeNullableText(payload.administrative_approval_remarks),
      remarks: normalizeNullableText(payload.remarks),
    };
  }

  ensureRole(employee, requiredRole) {
    const roles = this.normalizeRoleNames(employee?.assigned_roles);
    return roles.includes(String(requiredRole || "").toUpperCase());
  }

  buildWorkQueueSummary(items = []) {
    const list = Array.isArray(items) ? items : [];
    return {
      total_items: list.length,
      assigned_items: list.filter((item) => String(item?.assignment_status || "").toLowerCase() === "assigned").length,
      returned_items: list.filter((item) => String(item?.assignment_status || "").toLowerCase() === "returned").length,
      estimated_items: list.filter((item) => asAmountNumber(item?.estimated_amount) > 0).length,
      pending_estimate_items: list.filter(
        (item) =>
          ["assigned", "reassigned"].includes(String(item?.assignment_status || "").toLowerCase()) &&
          asAmountNumber(item?.estimated_amount) <= 0,
      ).length,
    };
  }

  deriveIndentStatus(items = []) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return "received";

    const assignedCount = list.filter((item) => Number(item?.assigned_procurement_officer_id || 0) > 0).length;
    const returnedCount = list.filter((item) => String(item?.assignment_status || "").toLowerCase() === "returned").length;
    const estimatedCount = list.filter((item) => asAmountNumber(item?.estimated_amount) > 0).length;

    if (!assignedCount) return "received";
    if (estimatedCount === list.length) return "estimate_ready";
    if (estimatedCount > 0) return "under_estimation";
    if (returnedCount === list.length) return "returned";
    if (returnedCount > 0) return "partially_returned";
    return "assigned";
  }

  resolveActorLabel({ actorEmployee = null, actorName = "", actorEmpcode = "" } = {}) {
    if (actorEmployee?.employee_name) {
      return actorEmployee.empcode
        ? `${actorEmployee.employee_name} (${actorEmployee.empcode})`
        : actorEmployee.employee_name;
    }

    const normalizedName = normalizeText(actorName);
    const normalizedEmpcode = normalizeText(actorEmpcode);
    if (normalizedName && normalizedEmpcode) return `${normalizedName} (${normalizedEmpcode})`;
    if (normalizedName) return normalizedName;
    if (normalizedEmpcode) return normalizedEmpcode;
    return "System";
  }

  resolveFinancialYear(dateValue) {
    const date = new Date(dateValue);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const startYear = month >= 4 ? year : year - 1;
    const endYear = startYear + 1;
    return {
      label: `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`,
      startDate: `${startYear}-04-01`,
      endDate: `${endYear}-03-31`,
    };
  }

  async generateSystemIndentNo({ receivedDate }, transaction) {
    const financialYear = this.resolveFinancialYear(receivedDate);
    const sequence =
      (await this.repository.countIndentsInFinancialYear(
        financialYear.startDate,
        financialYear.endDate,
        { transaction },
      )) + 1;
    return `PMS/${financialYear.label}/${String(sequence).padStart(4, "0")}`;
  }

  async logItemEvent(
    transaction,
    {
      indent_item_id,
      event_type,
      actor_procurement_employee_id = null,
      from_procurement_officer_id = null,
      to_procurement_officer_id = null,
      details = null,
      remarks = null,
    },
  ) {
    return this.repository.createIndentItemEvent(
      {
        indent_item_id,
        event_type,
        event_at: new Date(),
        actor_procurement_employee_id,
        from_procurement_officer_id,
        to_procurement_officer_id,
        details: details ? String(details) : null,
        remarks: remarks ? String(remarks) : null,
      },
      { transaction },
    );
  }

  normalizeIndentItems(items = []) {
    return (Array.isArray(items) ? items : [])
      .map((item) => ({
        id: item?.id ? asId(item.id, "Indent item") : null,
        category_id: item?.category_id ? asId(item.category_id, "Category") : null,
        subcategory_id: item?.subcategory_id ? asId(item.subcategory_id, "Subcategory") : null,
        item_name: normalizeText(item?.item_name),
        quantity: normalizeAmount(item?.quantity) || null,
        unit: normalizeText(item?.unit),
        specification: normalizeNullableText(item?.specification),
        specific_make_required: this.normalizeYesNoBoolean(item?.specific_make_required),
        preferred_make: normalizeNullableText(item?.preferred_make),
        administrative_approval_status:
          this.normalizeAdministrativeApprovalStatus(item),
        administrative_approval_required:
          this.normalizeAdministrativeApprovalStatus(item) !== "not_required",
        administrative_approval_document_path: normalizeNullableText(item?.administrative_approval_document_path),
        remarks: normalizeNullableText(item?.remarks),
      }))
      .filter(
        (item) =>
          item.category_id ||
          item.subcategory_id ||
          item.item_name ||
          item.quantity !== null ||
          item.unit ||
          item.preferred_make ||
          item.remarks,
      );
  }

  async validateFinalIndent({ indentPayload, items }) {
    if (!indentPayload.indent_document_path) {
      const error = new Error("Indent upload is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!items.length) {
      const error = new Error("At least one indent item is required.");
      error.statusCode = 400;
      throw error;
    }

    for (const item of items) {
      if (!item.item_name) {
        const error = new Error("Each indent item must have an item name.");
        error.statusCode = 400;
        throw error;
      }
      if (!item.quantity) {
        const error = new Error("Each indent item must have quantity.");
        error.statusCode = 400;
        throw error;
      }
      if (!item.unit) {
        const error = new Error("Each indent item must have unit.");
        error.statusCode = 400;
        throw error;
      }
      if (!item.category_id) {
        const error = new Error("Each indent item must have category.");
        error.statusCode = 400;
        throw error;
      }
      if (!item.subcategory_id) {
        const error = new Error("Each indent item must have sub category.");
        error.statusCode = 400;
        throw error;
      }
      const [category, subcategory] = await Promise.all([
        this.repository.findItemCategoryByPk(item.category_id),
        this.repository.findItemSubcategoryByPk(item.subcategory_id),
      ]);
      if (!category || !category.is_active) {
        const error = new Error("Selected item category is invalid or inactive.");
        error.statusCode = 400;
        throw error;
      }
      if (
        !subcategory ||
        !subcategory.is_active ||
        Number(subcategory.category_id) !== Number(item.category_id)
      ) {
        const error = new Error("Selected item sub category is invalid for the chosen category.");
        error.statusCode = 400;
        throw error;
      }
      if (item.specific_make_required && !item.preferred_make) {
        const error = new Error("Specific make / company name is required when specific make is marked yes.");
        error.statusCode = 400;
        throw error;
      }
    }
  }

  buildItemCreatePayload(item, indentId, creatorId = null) {
    return {
      indent_id: indentId,
      category_id: item.category_id,
      subcategory_id: item.subcategory_id,
      item_name: item.item_name || null,
      quantity: item.quantity,
      unit: item.unit || null,
      specification: item.specification,
      specific_make_required: item.specific_make_required,
      estimated_rate: null,
      estimated_amount: null,
      preferred_make: item.preferred_make,
      administrative_approval_required: item.administrative_approval_required,
      administrative_approval_status: item.administrative_approval_status,
      administrative_approval_document_path: null,
      assigned_procurement_officer_id: null,
      assigned_at: null,
      assignment_status: "unassigned",
      procurement_decision_status: "pending",
      return_reason: null,
      returned_at: null,
      estimated_by_procurement_officer_id: null,
      estimated_at: null,
      remarks: item.remarks,
      created_by: creatorId,
      updated_by: creatorId,
    };
  }

  buildItemUpdatePayload(item, updaterId = null) {
    return {
      category_id: item.category_id,
      subcategory_id: item.subcategory_id,
      item_name: item.item_name || null,
      quantity: item.quantity,
      unit: item.unit || null,
      specification: item.specification,
      specific_make_required: item.specific_make_required,
      preferred_make: item.preferred_make,
      administrative_approval_required: item.administrative_approval_required,
      administrative_approval_status: item.administrative_approval_status,
      remarks: item.remarks,
      updated_by: updaterId,
    };
  }

  async assertApprovedIndentChangeRequest(indentId, payload = {}) {
    const approvalRequestId = payload.approval_request_id
      ? asId(payload.approval_request_id, "Approval request")
      : null;

    if (!approvalRequestId) {
      const error = new Error("Approved update request is required to edit a submitted indent.");
      error.statusCode = 409;
      throw error;
    }

    const request = await this.approvalService.findApprovedChangeRequest({
      id: approvalRequestId,
      moduleKey: "indents",
      entityType: "indent",
      entityId: indentId,
    });

    if (!request) {
      const error = new Error("No approved update request is available for this indent.");
      error.statusCode = 403;
      throw error;
    }

    return request;
  }

  decorateIndent(indent) {
    if (!indent) return indent;

    const target = indent.dataValues || indent;
    const items = Array.isArray(target.items || indent.items) ? target.items || indent.items : [];
    const cases = Array.isArray(target.procurement_cases || indent.procurement_cases)
      ? target.procurement_cases || indent.procurement_cases
      : [];

    const assignedCount = items.filter((item) => Number(item?.assigned_procurement_officer_id) > 0).length;
    const returnedCount = items.filter((item) => String(item?.assignment_status || "").toLowerCase() === "returned").length;
    const estimatedCount = items.filter((item) => asAmountNumber(item?.estimated_amount) > 0).length;
    const caseCreatedCount = items.filter((item) => String(item?.procurement_decision_status || "").toLowerCase() === "case_created").length;
    const totalEstimatedAmount = items.reduce((sum, item) => sum + asAmountNumber(item?.estimated_amount), 0);

    const storedStatus = this.getCurrentStatus(target.status || indent.status);
    target.status = storedStatus === "draft" ? "draft" : this.deriveIndentStatus(items);
    target.item_count = items.length;
    target.assigned_item_count = assignedCount;
    target.unassigned_item_count = Math.max(items.length - assignedCount, 0);
    target.returned_item_count = returnedCount;
    target.estimated_item_count = estimatedCount;
    target.unestimated_item_count = Math.max(items.length - estimatedCount, 0);
    target.procurement_case_count = cases.length;
    target.case_created_item_count = caseCreatedCount;
    target.pending_item_count = Math.max(items.length - caseCreatedCount, 0);
    target.total_estimated_amount = Number(totalEstimatedAmount.toFixed(2));

    const indentTimeline = [];
    if (indent?.createdAt || target.createdAt) {
      indentTimeline.push({
        id: `indent-created-${target.id || indent.id || "na"}`,
        scope: "indent",
        event_type: "indent_created",
        event_at: indent.createdAt || target.createdAt,
        actor_label: this.resolveActorLabel({
          actorEmployee: target.creator || indent.creator,
        }),
        description: "Indent was created and received into the inward procurement workflow.",
        item_name: null,
      });
    }

    for (const item of items) {
      for (const event of Array.isArray(item?.events) ? item.events : []) {
        indentTimeline.push({
          id: event.id,
          scope: "item",
          event_type: event.event_type,
          event_at: event.event_at,
          actor_label: this.resolveActorLabel({
            actorEmployee: event.actor,
          }),
          from_label: event.from_officer
            ? this.resolveActorLabel({
                actorEmployee: event.from_officer,
              })
            : null,
          to_label: event.to_officer
            ? this.resolveActorLabel({
                actorEmployee: event.to_officer,
              })
            : null,
          description: event.details || null,
          remarks: event.remarks || null,
          item_name: item.item_name || "NA",
          quantity: item.quantity,
          unit: item.unit,
        });
      }
    }

    target.timeline = indentTimeline.sort(
      (left, right) => new Date(right?.event_at || 0).getTime() - new Date(left?.event_at || 0).getTime(),
    );
    return indent;
  }

  async decorateIndentListRows(rows = []) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return list;

    const indentIds = list.map((row) => row?.id).filter(Boolean);
    const [items, cases] = await Promise.all([
      this.repository.findItemsByIndentIds(indentIds),
      this.repository.findCasesByIndentIds(indentIds),
    ]);

    const itemsByIndentId = new Map();
    for (const item of items || []) {
      const indentId = Number(item?.indent_id);
      if (!itemsByIndentId.has(indentId)) itemsByIndentId.set(indentId, []);
      itemsByIndentId.get(indentId).push(item);
    }

    const casesByIndentId = new Map();
    for (const procurementCase of cases || []) {
      const indentId = Number(procurementCase?.indent_id);
      if (!casesByIndentId.has(indentId)) casesByIndentId.set(indentId, []);
      casesByIndentId.get(indentId).push(procurementCase);
    }

    return list.map((row) => {
      const indent = typeof row?.toJSON === "function" ? row.toJSON() : { ...row };
      const indentId = Number(indent.id);
      indent.items = itemsByIndentId.get(indentId) || [];
      indent.procurement_cases = casesByIndentId.get(indentId) || [];
      return this.decorateIndent(indent);
    });
  }

  async list(query = {}) {
    const search = normalizeText(query.search);
    const where = search
      ? {
          [Op.or]: [
            { indent_no: { [Op.like]: `%${search}%` } },
            { cfms_no: { [Op.like]: `%${search}%` } },
            { department_name: { [Op.like]: `%${search}%` } },
            { status: { [Op.like]: `%${search}%` } },
          ],
        }
      : {};

    const sortBy = normalizeSortBy(query.sortBy || query.sort_by, INDENT_SORT_FIELDS, "id");
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
      response.rows = await this.decorateIndentListRows(response.rows);
      return response;
    }

    return this.decorateIndentListRows(
      await this.repository.listBase({ where, limit: 100, sortBy, sortDirection }),
    );
  }

  async getById(id) {
    const indent = await this.repository.findByPk(asId(id, "Indent id"));
    if (!indent) throw notFound("Indent not found.");
    return this.decorateIndent(indent);
  }

  async create(payload = {}) {
    const draft = this.isDraftPayload(payload);
    const indentPayload = this.buildIndentPayload(payload, { draft });
    const items = this.normalizeIndentItems(payload.items);
    const actorEmpcode = normalizeText(payload.actor_empcode);
    const actorName = normalizeText(payload.actor_name);

    if (!draft) await this.validateFinalIndent({ indentPayload, items });

    const creator = actorEmpcode
      ? await this.repository.findProcurementEmployeeByEmpcode(actorEmpcode)
      : null;

    const indent = await this.repository.withTransaction(async (transaction) => {
      const systemIndentNo = draft
        ? null
        : await this.generateSystemIndentNo(
            { receivedDate: indentPayload.received_date },
            transaction,
          );
      const createdIndent = await this.repository.createIndent(
        {
          system_indent_no: systemIndentNo,
          ...indentPayload,
          status: draft ? "draft" : "received",
          created_by: creator?.id || null,
          updated_by: creator?.id || null,
        },
        { transaction },
      );

      const createdItems = items.length
        ? await this.repository.bulkCreateItems(
            items.map((item) =>
              this.buildItemCreatePayload(item, createdIndent.id, creator?.id || null),
            ),
            { transaction },
          )
        : [];

      if (!draft) {
        for (const item of createdItems) {
          if (!item?.id) continue;
          await this.logItemEvent(transaction, {
            indent_item_id: item.id,
            event_type: "indent_item_created",
            actor_procurement_employee_id: creator?.id || null,
            details: `${this.resolveActorLabel({ actorEmployee: creator, actorName, actorEmpcode })} created this indent item at inward stage.`,
          });
        }
      }

      return createdIndent;
    });

    return this.getById(indent.id);
  }

  async update(id, payload = {}) {
    const indent = await this.repository.findByPk(asId(id, "Indent id"));
    if (!indent) throw notFound("Indent not found.");

    const isDraftIndent = this.getCurrentStatus(indent.status) === "draft";
    const approvedChangeRequest = isDraftIndent
      ? null
      : await this.assertApprovedIndentChangeRequest(indent.id, payload);

    const draft = this.isDraftPayload(payload);
    if (!isDraftIndent && draft) {
      const error = new Error("Approved saved-record edits must be submitted, not saved as draft.");
      error.statusCode = 400;
      throw error;
    }

    const indentPayload = this.buildIndentPayload(payload, { draft });
    const items = this.normalizeIndentItems(payload.items);
    const actorEmpcode = normalizeText(payload.actor_empcode);
    const actorName = normalizeText(payload.actor_name);

    if (!draft) await this.validateFinalIndent({ indentPayload, items });

    const actor = actorEmpcode
      ? await this.repository.findProcurementEmployeeByEmpcode(actorEmpcode)
      : null;

    await this.repository.withTransaction(async (transaction) => {
      const systemIndentNo = draft
        ? indent.system_indent_no || null
        : indent.system_indent_no ||
          (await this.generateSystemIndentNo(
            { receivedDate: indentPayload.received_date },
            transaction,
          ));

      const nextStatus = isDraftIndent
        ? draft
          ? "draft"
          : "received"
        : indent.status || this.deriveIndentStatus(indent.items);

      await this.repository.updateIndent(
        indent,
        {
          system_indent_no: systemIndentNo,
          ...indentPayload,
          status: nextStatus,
          updated_by: actor?.id || null,
        },
        { transaction },
      );

      let createdItems = [];

      if (isDraftIndent) {
        await this.repository.deleteItemsByIndentId(indent.id, { transaction });
        createdItems = items.length
          ? await this.repository.bulkCreateItems(
              items.map((item) =>
                this.buildItemCreatePayload(item, indent.id, actor?.id || null),
              ),
              { transaction },
            )
          : [];
      } else {
        const existingItems = Array.isArray(indent.items) ? indent.items : [];
        const existingById = new Map(
          existingItems.map((item) => [Number(item.id), item]),
        );

        for (const item of items) {
          if (item.id && existingById.has(Number(item.id))) {
            await this.repository.updateIndentItem(
              existingById.get(Number(item.id)),
              this.buildItemUpdatePayload(item, actor?.id || null),
              { transaction },
            );
            continue;
          }

          const [createdItem] = await this.repository.bulkCreateItems(
            [this.buildItemCreatePayload(item, indent.id, actor?.id || null)],
            { transaction },
          );
          if (createdItem) createdItems.push(createdItem);
        }
      }

      if (!draft) {
        for (const item of createdItems) {
          if (!item?.id) continue;
          await this.logItemEvent(transaction, {
            indent_item_id: item.id,
            event_type: "indent_item_created",
            actor_procurement_employee_id: actor?.id || null,
            details: isDraftIndent
              ? `${this.resolveActorLabel({ actorEmployee: actor, actorName, actorEmpcode })} submitted this draft indent item at inward stage.`
              : `${this.resolveActorLabel({ actorEmployee: actor, actorName, actorEmpcode })} added this item through an approved saved-record update.`,
          });
        }
      }
    });

    if (approvedChangeRequest) {
      await this.approvalService.markApplied(
        approvedChangeRequest.id,
        { applied_payload: payload },
        {
          employee_id: actor?.id || null,
          name: this.resolveActorLabel({ actorEmployee: actor, actorName, actorEmpcode }),
        },
      );
    }

    return this.getById(indent.id);
  }

  async updateDocuments(id, payload = {}) {
    const indent = await this.repository.findByPk(asId(id, "Indent id"));
    if (!indent) throw notFound("Indent not found.");

    const update = {};
    if ("indent_document_path" in payload) {
      const indentDocumentPath = normalizeNullableText(payload.indent_document_path);
      if (!indentDocumentPath) {
        const error = new Error("Indent upload is required.");
        error.statusCode = 400;
        throw error;
      }
      update.indent_document_path = indentDocumentPath;
    }
    if ("specification_document_path" in payload) {
      update.specification_document_path = normalizeNullableText(payload.specification_document_path);
    }
    if ("administrative_approval_document_path" in payload) {
      update.administrative_approval_document_path = normalizeNullableText(
        payload.administrative_approval_document_path,
      );
    }
    if ("administrative_approval_remarks" in payload) {
      update.administrative_approval_remarks = normalizeNullableText(
        payload.administrative_approval_remarks,
      );
    }

    if (!Object.keys(update).length) return this.getById(indent.id);
    await this.repository.updateIndent(indent, update);
    return this.getById(indent.id);
  }

  async addDocument(id, payload = {}) {
    const indent = await this.repository.findByPk(asId(id, "Indent id"));
    if (!indent) throw notFound("Indent not found.");

    const documentPath = normalizeText(payload.document_path);
    if (!documentPath) {
      const error = new Error("Document upload is required.");
      error.statusCode = 400;
      throw error;
    }

    const actorEmpcode = normalizeText(payload.actor_empcode);
    const actor = actorEmpcode
      ? await this.repository.findProcurementEmployeeByEmpcode(actorEmpcode)
      : null;

    await this.repository.createIndentDocument({
      indent_id: indent.id,
      document_type: normalizeText(payload.document_type) || "supporting_document",
      document_title: normalizeNullableText(payload.document_title),
      document_path: documentPath,
      communication_direction: normalizeNullableText(payload.communication_direction),
      reference_no: normalizeNullableText(payload.reference_no),
      reference_date: normalizeNullableDate(payload.reference_date),
      remarks: normalizeNullableText(payload.remarks),
      uploaded_by: actor?.id || null,
    });

    return this.getById(indent.id);
  }

  async getWorkQueue(query = {}) {
    const empcode = normalizeText(query.empcode);
    if (!empcode) {
      const error = new Error("Employee code is required to load the work queue.");
      error.statusCode = 400;
      throw error;
    }

    const employee = await this.repository.findProcurementEmployeeByEmpcode(empcode);
    if (!employee) throw notFound("Procurement employee not found.");

    const items = await this.repository.listWorkQueueByOfficerId(employee.id);
    const rows = items.map((item) => (typeof item?.toJSON === "function" ? item.toJSON() : item));
    return {
      employee: {
        id: employee.id,
        empcode: employee.empcode,
        employee_name: employee.employee_name,
        designation: employee.designation,
        division: employee.division,
      },
      summary: this.buildWorkQueueSummary(rows),
      rows,
    };
  }

  async assignItem(itemId, payload = {}) {
    const targetItem = await this.repository.findIndentItemByPk(asId(itemId, "Indent item id"));
    if (!targetItem) throw notFound("Indent item not found.");

    const currentAssignmentStatus = String(targetItem.assignment_status || "").toLowerCase();
    const actorEmpcode = normalizeText(payload.actor_empcode);
    const actorName = normalizeText(payload.actor_name);
    const officerId = asId(payload.procurement_officer_id, "Procurement officer");
    const officer = await this.repository.findProcurementEmployeeByPk(officerId);
    const actor = actorEmpcode
      ? await this.repository.findProcurementEmployeeByEmpcode(actorEmpcode)
      : null;
    if (!officer) throw notFound("Procurement officer not found.");
    if (!this.ensureRole(officer, "PROCUREMENT_OFFICER")) {
      const error = new Error("Selected employee is not assigned the Procurement Officer role.");
      error.statusCode = 400;
      throw error;
    }

    const previousOfficerId = Number(targetItem.assigned_procurement_officer_id || 0) || null;
    const nextStatus = previousOfficerId
      ? (currentAssignmentStatus === "returned" ? "reassigned" : "reassigned")
      : "assigned";

    await this.repository.withTransaction(async (transaction) => {
      await this.repository.updateIndentItem(targetItem, {
        assigned_procurement_officer_id: officer.id,
        assigned_at: new Date(),
        assignment_status: nextStatus,
        return_reason: null,
        returned_at: null,
        remarks: normalizeNullableText(payload.remarks || targetItem.remarks),
        updated_by: actor?.id || null,
      }, { transaction });

      await this.logItemEvent(transaction, {
        indent_item_id: targetItem.id,
        event_type: previousOfficerId ? "indent_item_reassigned" : "indent_item_assigned",
        actor_procurement_employee_id: actor?.id || null,
        from_procurement_officer_id: previousOfficerId,
        to_procurement_officer_id: officer.id,
        details: previousOfficerId
          ? `${this.resolveActorLabel({ actorEmployee: actor, actorName, actorEmpcode })} reassigned this item to ${officer.employee_name} (${officer.empcode}).`
          : `${this.resolveActorLabel({ actorEmployee: actor, actorName, actorEmpcode })} assigned this item to ${officer.employee_name} (${officer.empcode}).`,
        remarks: normalizeNullableText(payload.remarks),
      });
    });

    return this.repository.findIndentItemByPk(targetItem.id);
  }

  async returnItem(itemId, payload = {}) {
    const targetItem = await this.repository.findIndentItemByPk(asId(itemId, "Indent item id"));
    if (!targetItem) throw notFound("Indent item not found.");

    const actorEmpcode = normalizeText(payload.actor_empcode);
    const returnReason = normalizeText(payload.return_reason);
    if (!actorEmpcode) {
      const error = new Error("Officer employee code is required.");
      error.statusCode = 400;
      throw error;
    }
    if (!returnReason) {
      const error = new Error("Return reason is required.");
      error.statusCode = 400;
      throw error;
    }

    const actor = await this.repository.findProcurementEmployeeByEmpcode(actorEmpcode);
    if (!actor) throw notFound("Procurement officer not found.");
    if (Number(targetItem.assigned_procurement_officer_id || 0) !== Number(actor.id)) {
      const error = new Error("Only the assigned Procurement Officer can return this item.");
      error.statusCode = 403;
      throw error;
    }

    await this.repository.withTransaction(async (transaction) => {
      await this.repository.updateIndentItem(targetItem, {
        assignment_status: "returned",
        return_reason: returnReason,
        returned_at: new Date(),
        estimated_rate: null,
        estimated_amount: null,
        estimated_by_procurement_officer_id: null,
        estimated_at: null,
        remarks: normalizeNullableText(payload.remarks || targetItem.remarks),
        updated_by: actor?.id || null,
      }, { transaction });

      await this.logItemEvent(transaction, {
        indent_item_id: targetItem.id,
        event_type: "indent_item_returned",
        actor_procurement_employee_id: actor.id,
        from_procurement_officer_id: actor.id,
        details: `${this.resolveActorLabel({ actorEmployee: actor, actorEmpcode })} returned this item to admin. Reason: ${returnReason}`,
        remarks: normalizeNullableText(payload.remarks),
      });
    });

    return this.repository.findIndentItemByPk(targetItem.id);
  }

  async updateEstimate(itemId, payload = {}) {
    const targetItem = await this.repository.findIndentItemByPk(asId(itemId, "Indent item id"));
    if (!targetItem) throw notFound("Indent item not found.");

    const actorEmpcode = normalizeText(payload.actor_empcode);
    if (!actorEmpcode) {
      const error = new Error("Officer employee code is required.");
      error.statusCode = 400;
      throw error;
    }

    const actor = await this.repository.findProcurementEmployeeByEmpcode(actorEmpcode);
    if (!actor) throw notFound("Procurement officer not found.");
    if (Number(targetItem.assigned_procurement_officer_id || 0) !== Number(actor.id)) {
      const error = new Error("Only the assigned Procurement Officer can update the estimate for this item.");
      error.statusCode = 403;
      throw error;
    }

    const estimatedRate = normalizeAmount(payload.estimated_rate);
    let estimatedAmount = payload.estimated_amount === "" ? null : normalizeAmount(payload.estimated_amount);
    if (!estimatedRate || estimatedRate <= 0) {
      const error = new Error("Estimated rate is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!estimatedAmount || estimatedAmount <= 0) {
      estimatedAmount = Number((asAmountNumber(targetItem.quantity) * asAmountNumber(estimatedRate)).toFixed(2));
    }
    const administrativeApprovalStatus =
      estimatedAmount >= ADMINISTRATIVE_APPROVAL_THRESHOLD
        ? "auto_required"
        : targetItem.administrative_approval_status || (
            targetItem.administrative_approval_required ? "required" : "not_required"
          );

    await this.repository.withTransaction(async (transaction) => {
      await this.repository.updateIndentItem(targetItem, {
        estimated_rate: estimatedRate,
        estimated_amount: estimatedAmount,
        administrative_approval_required:
          administrativeApprovalStatus !== "not_required",
        administrative_approval_status: administrativeApprovalStatus,
        estimated_by_procurement_officer_id: actor.id,
        estimated_at: new Date(),
        remarks: normalizeNullableText(payload.remarks || targetItem.remarks),
        updated_by: actor?.id || null,
      }, { transaction });

      await this.logItemEvent(transaction, {
        indent_item_id: targetItem.id,
        event_type: "indent_item_estimated",
        actor_procurement_employee_id: actor.id,
        from_procurement_officer_id: actor.id,
        details: `${this.resolveActorLabel({ actorEmployee: actor, actorEmpcode })} recorded estimated rate ${estimatedRate} and estimated amount ${estimatedAmount}.`,
        remarks: normalizeNullableText(payload.remarks),
      });
    });

    return this.repository.findIndentItemByPk(targetItem.id);
  }
}

module.exports = IndentService;
