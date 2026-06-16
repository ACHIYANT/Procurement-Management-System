const { Op } = require("sequelize");
const { sequelize } = require("../../models");
const { ApprovalRepository } = require("../repository/approval-repository");
const {
  asId,
  normalizeNullableText,
  normalizeText,
  notFound,
  requireValue,
} = require("../utils/procurement-domain");

const ACTIVE_REQUEST_STATUSES = new Set(["pending", "approved"]);
const FINAL_REQUEST_STATUSES = new Set(["applied", "rejected", "cancelled"]);
const INDENT_CHANGE_REQUEST_ROLES = new Set(["INDENT_INITIATOR", "ADMIN", "SUPER_ADMIN"]);

const normalizeRole = (role) =>
  normalizeText(role)?.toUpperCase().replace(/\s+/g, "_") || null;

const normalizeRoles = (roles) => {
  if (Array.isArray(roles)) return roles.map(normalizeRole).filter(Boolean);
  if (!roles) return [];
  return String(roles)
    .split(",")
    .map(normalizeRole)
    .filter(Boolean);
};

const normalizeBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "active"].includes(String(value).toLowerCase());
};

const normalizePositiveInt = (value, label, fallback = 1) => {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    const error = new Error(`${label} must be a positive number.`);
    error.statusCode = 400;
    throw error;
  }
  return number;
};

class ApprovalService {
  constructor() {
    this.repository = new ApprovalRepository();
  }

  normalizeLevel(level = {}, index) {
    const approverType = normalizeText(level.approver_type) || "role";
    const normalized = {
      level_no: normalizePositiveInt(level.level_no, "Level no", index + 1),
      level_name: requireValue(level, "level_name", "Level name"),
      approver_type: approverType,
      approver_role: normalizeRole(level.approver_role),
      approver_employee_id: level.approver_employee_id
        ? asId(level.approver_employee_id, "Approver employee id")
        : null,
      min_required_approvals: normalizePositiveInt(
        level.min_required_approvals,
        "Required approvals",
        1,
      ),
      is_final_level: Boolean(level.is_final_level),
    };

    if (approverType === "role" && !normalized.approver_role) {
      const error = new Error("Approver role is required for role based approval level.");
      error.statusCode = 400;
      throw error;
    }

    if (approverType === "employee" && !normalized.approver_employee_id) {
      const error = new Error("Approver employee is required for employee based approval level.");
      error.statusCode = 400;
      throw error;
    }

    return normalized;
  }

  normalizeWorkflowPayload(payload = {}) {
    const levels = Array.isArray(payload.levels) ? payload.levels : [];
    if (!levels.length) {
      const error = new Error("At least one approval level is required.");
      error.statusCode = 400;
      throw error;
    }

    const normalizedLevels = levels
      .map((level, index) => this.normalizeLevel(level, index))
      .sort((left, right) => left.level_no - right.level_no)
      .map((level, index, allLevels) => ({
        ...level,
        level_no: index + 1,
        is_final_level: index === allLevels.length - 1,
      }));

    return {
      workflow: {
        module_key: requireValue(payload, "module_key", "Module key"),
        action_key: requireValue(payload, "action_key", "Action key"),
        workflow_name: requireValue(payload, "workflow_name", "Workflow name"),
        description: normalizeNullableText(payload.description),
        is_active: normalizeBoolean(payload.is_active, true),
        created_by_employee_id: payload.created_by_employee_id
          ? asId(payload.created_by_employee_id, "Created by employee id")
          : null,
      },
      levels: normalizedLevels,
    };
  }

  async listWorkflows(query = {}) {
    const where = {};
    if (query.module_key) where.module_key = normalizeText(query.module_key);
    if (query.action_key) where.action_key = normalizeText(query.action_key);
    if (query.is_active !== undefined) where.is_active = normalizeBoolean(query.is_active, true);
    return this.repository.listWorkflows(where);
  }

  async createWorkflow(payload = {}) {
    const normalized = this.normalizeWorkflowPayload(payload);
    return sequelize.transaction(async (transaction) => {
      if (normalized.workflow.is_active) {
        const activeWorkflow = await this.repository.findActiveWorkflow(
          normalized.workflow.module_key,
          normalized.workflow.action_key,
          transaction,
        );
        if (activeWorkflow) {
          await activeWorkflow.update({ is_active: false }, { transaction });
        }
      }

      const workflow = await this.repository.createWorkflow(normalized.workflow, transaction);
      await this.repository.replaceWorkflowLevels(workflow.id, normalized.levels, transaction);
      return this.repository.findWorkflowById(workflow.id, transaction);
    });
  }

  async updateWorkflow(id, payload = {}) {
    const workflowId = asId(id, "Approval workflow id");
    const normalized = this.normalizeWorkflowPayload(payload);
    return sequelize.transaction(async (transaction) => {
      const workflow = await this.repository.findWorkflowById(workflowId, transaction);
      if (!workflow) throw notFound("Approval workflow not found.");

      if (normalized.workflow.is_active) {
        const activeWorkflow = await this.repository.findActiveWorkflow(
          normalized.workflow.module_key,
          normalized.workflow.action_key,
          transaction,
        );
        if (activeWorkflow && Number(activeWorkflow.id) !== workflowId) {
          await activeWorkflow.update({ is_active: false }, { transaction });
        }
      }

      await this.repository.updateWorkflow(workflow, normalized.workflow, transaction);
      await this.repository.replaceWorkflowLevels(workflowId, normalized.levels, transaction);
      return this.repository.findWorkflowById(workflowId, transaction);
    });
  }

  normalizeRequestPayload(payload = {}, actor = {}) {
    return {
      module_key: requireValue(payload, "module_key", "Module key"),
      action_key: requireValue(payload, "action_key", "Action key"),
      entity_type: requireValue(payload, "entity_type", "Entity type"),
      entity_id: requireValue(payload, "entity_id", "Entity id"),
      request_title: requireValue(payload, "request_title", "Request title"),
      request_reason: normalizeNullableText(payload.request_reason),
      requested_by_employee_id: payload.requested_by_employee_id
        ? asId(payload.requested_by_employee_id, "Requested by employee id")
        : actor.employee_id || null,
      requested_by_name:
        normalizeNullableText(payload.requested_by_name) ||
        normalizeNullableText(actor.name),
      old_payload: payload.old_payload || null,
      proposed_payload: payload.proposed_payload || {},
    };
  }

  async createRequest(payload = {}, actor = {}) {
    const normalized = this.normalizeRequestPayload(payload, actor);
    if (
      normalized.module_key === "indents" &&
      normalized.action_key === "change_saved_record"
    ) {
      const actorRoles = normalizeRoles(actor.roles);
      const canRequestIndentChange = actorRoles.some((role) =>
        INDENT_CHANGE_REQUEST_ROLES.has(role),
      );

      if (!canRequestIndentChange) {
        const error = new Error(
          "Only Indent Initiator, Admin, or Super Admin can request indent update approval.",
        );
        error.statusCode = 403;
        throw error;
      }
    }

    return sequelize.transaction(async (transaction) => {
      const workflow = await this.repository.findActiveWorkflow(
        normalized.module_key,
        normalized.action_key,
        transaction,
      );

      if (!workflow || !Array.isArray(workflow.levels) || !workflow.levels.length) {
        const error = new Error(
          "No active approval workflow is configured for this module and action.",
        );
        error.statusCode = 400;
        throw error;
      }

      const firstLevel = workflow.levels[0];
      const request = await this.repository.createRequest(
        {
          approval_workflow_id: workflow.id,
          module_key: normalized.module_key,
          action_key: normalized.action_key,
          entity_type: normalized.entity_type,
          entity_id: normalized.entity_id,
          request_title: normalized.request_title,
          request_reason: normalized.request_reason,
          status: "pending",
          current_level_no: firstLevel.level_no,
          requested_by_employee_id: normalized.requested_by_employee_id,
          requested_by_name: normalized.requested_by_name,
        },
        transaction,
      );

      await this.repository.createRequestPayload(
        {
          approval_request_id: request.id,
          old_payload: normalized.old_payload,
          proposed_payload: normalized.proposed_payload,
          applied_payload: null,
        },
        transaction,
      );

      await this.repository.createRequestSteps(
        workflow.levels.map((level) => ({
          approval_request_id: request.id,
          level_no: level.level_no,
          level_name: level.level_name,
          approver_type: level.approver_type,
          approver_role: level.approver_role,
          approver_employee_id: level.approver_employee_id,
          min_required_approvals: level.min_required_approvals,
          status: level.level_no === firstLevel.level_no ? "pending" : "waiting",
        })),
        transaction,
      );

      return this.repository.findRequestById(request.id, transaction);
    });
  }

  async listRequests(query = {}) {
    const where = {};
    if (query.status) where.status = normalizeText(query.status);
    if (query.module_key) where.module_key = normalizeText(query.module_key);
    if (query.action_key) where.action_key = normalizeText(query.action_key);
    if (query.entity_type) where.entity_type = normalizeText(query.entity_type);
    if (query.entity_id) where.entity_id = normalizeText(query.entity_id);
    if (query.activeOnly === "true" || query.active_only === "true") {
      where.status = { [Op.in]: Array.from(ACTIVE_REQUEST_STATUSES) };
    }
    return this.repository.listRequests(where);
  }

  async findApprovedChangeRequest(
    { id = null, moduleKey, actionKey = "change_saved_record", entityType, entityId },
    transaction,
  ) {
    return this.repository.findApprovedChangeRequest(
      { id, moduleKey, actionKey, entityType, entityId },
      transaction,
    );
  }

  ensureRequestCanMove(request) {
    if (!request) throw notFound("Approval request not found.");
    if (FINAL_REQUEST_STATUSES.has(request.status)) {
      const error = new Error("This approval request is already closed.");
      error.statusCode = 400;
      throw error;
    }
  }

  getCurrentStep(request) {
    const steps = Array.isArray(request.steps) ? request.steps : [];
    const currentStep = steps.find(
      (step) =>
        Number(step.level_no) === Number(request.current_level_no) &&
        step.status === "pending",
    );
    if (!currentStep) {
      const error = new Error("No pending approval step is available for this request.");
      error.statusCode = 400;
      throw error;
    }
    return currentStep;
  }

  ensureActorCanApprove(step, actor = {}) {
    const actorRoles = normalizeRoles(actor.roles);
    const actorEmployeeId = actor.employee_id ? Number(actor.employee_id) : null;
    const isAdmin = actorRoles.includes("ADMIN") || actorRoles.includes("SUPER_ADMIN");

    if (isAdmin) return;

    if (step.approver_type === "employee") {
      if (actorEmployeeId && Number(step.approver_employee_id) === actorEmployeeId) return;
    }

    if (step.approver_type === "role" && step.approver_role) {
      if (actorRoles.includes(normalizeRole(step.approver_role))) return;
    }

    if (!actorRoles.length && !actorEmployeeId) return;

    const error = new Error("You are not an approver for the current approval level.");
    error.statusCode = 403;
    throw error;
  }

  async approveRequest(id, payload = {}, actor = {}) {
    const requestId = asId(id, "Approval request id");
    return sequelize.transaction(async (transaction) => {
      const request = await this.repository.findRequestById(requestId, transaction);
      this.ensureRequestCanMove(request);
      const currentStep = this.getCurrentStep(request);
      this.ensureActorCanApprove(currentStep, actor);

      await currentStep.update(
        {
          status: "approved",
          approved_by_employee_id: actor.employee_id || null,
          approved_by_name:
            normalizeNullableText(payload.approved_by_name) ||
            normalizeNullableText(actor.name),
          approved_at: new Date(),
          remarks: normalizeNullableText(payload.remarks),
        },
        { transaction },
      );

      const steps = [...(request.steps || [])].sort((left, right) => left.level_no - right.level_no);
      const nextStep = steps.find((step) => step.level_no > currentStep.level_no);

      if (nextStep) {
        await nextStep.update({ status: "pending" }, { transaction });
        await request.update(
          { status: "pending", current_level_no: nextStep.level_no },
          { transaction },
        );
      } else {
        await request.update(
          {
            status: "approved",
            current_level_no: null,
          },
          { transaction },
        );
      }

      return this.repository.findRequestById(requestId, transaction);
    });
  }

  async rejectRequest(id, payload = {}, actor = {}) {
    const requestId = asId(id, "Approval request id");
    return sequelize.transaction(async (transaction) => {
      const request = await this.repository.findRequestById(requestId, transaction);
      this.ensureRequestCanMove(request);
      const currentStep = this.getCurrentStep(request);
      this.ensureActorCanApprove(currentStep, actor);

      await currentStep.update(
        {
          status: "rejected",
          approved_by_employee_id: actor.employee_id || null,
          approved_by_name:
            normalizeNullableText(payload.rejected_by_name) ||
            normalizeNullableText(actor.name),
          approved_at: new Date(),
          remarks: normalizeNullableText(payload.remarks),
        },
        { transaction },
      );

      await request.update(
        {
          status: "rejected",
          rejected_at: new Date(),
          current_level_no: null,
        },
        { transaction },
      );

      return this.repository.findRequestById(requestId, transaction);
    });
  }

  async markApplied(id, payload = {}, actor = {}) {
    const requestId = asId(id, "Approval request id");
    return sequelize.transaction(async (transaction) => {
      const request = await this.repository.findRequestById(requestId, transaction);
      if (!request) throw notFound("Approval request not found.");
      if (request.status !== "approved") {
        const error = new Error("Only approved requests can be marked as applied.");
        error.statusCode = 400;
        throw error;
      }

      if (request.payload) {
        await request.payload.update(
          {
            applied_payload: payload.applied_payload || request.payload.proposed_payload,
          },
          { transaction },
        );
      }

      await request.update(
        {
          status: "applied",
          applied_at: new Date(),
          current_level_no: null,
        },
        { transaction },
      );

      return this.repository.findRequestById(requestId, transaction);
    });
  }
}

module.exports = ApprovalService;
