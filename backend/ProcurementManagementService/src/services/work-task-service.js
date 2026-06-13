const { Op } = require("sequelize");
const { sequelize } = require("../../models");
const { WorkTaskRepository } = require("../repository/work-task-repository");
const {
  asId,
  normalizeNullableText,
  normalizeText,
  notFound,
  requireValue,
} = require("../utils/procurement-domain");

const TASK_STATUSES = new Set([
  "open",
  "in_progress",
  "completed",
  "returned",
  "reassigned",
  "cancelled",
]);

const PRIORITIES = new Set(["low", "medium", "high", "critical"]);
const SEVERITIES = new Set(["normal", "important", "urgent", "critical"]);
const ORIGIN_TYPES = new Set([
  "self",
  "manual_assignment",
  "system",
  "delegated",
  "escalated",
]);

const toSnake = (value, fallback) =>
  String(value || fallback || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const toDateOrNull = (value, label) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${label} must be a valid date/time.`);
    error.statusCode = 400;
    throw error;
  }
  return date;
};

const normalizeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }
  return [];
};

const displayNameFromActor = (actor = {}) =>
  normalizeNullableText(actor.name) ||
  normalizeNullableText(actor.employee_name) ||
  normalizeNullableText(actor.fullname) ||
  null;

class WorkTaskService {
  constructor() {
    this.repository = new WorkTaskRepository();
  }

  normalizeTaskPayload(payload = {}, actor = {}) {
    const originType = toSnake(payload.origin_type, "self");
    if (!ORIGIN_TYPES.has(originType)) {
      const error = new Error("Invalid task origin.");
      error.statusCode = 400;
      throw error;
    }

    const priority = toSnake(payload.priority, "medium");
    if (!PRIORITIES.has(priority)) {
      const error = new Error("Invalid task priority.");
      error.statusCode = 400;
      throw error;
    }

    const severity = toSnake(payload.severity, priority === "critical" ? "critical" : "normal");
    if (!SEVERITIES.has(severity)) {
      const error = new Error("Invalid task severity.");
      error.statusCode = 400;
      throw error;
    }

    const actorEmployeeId = actor.employee_id ? asId(actor.employee_id, "Actor employee id") : null;
    const actorName = displayNameFromActor(actor);
    const assignedByEmployeeId = payload.assigned_by_employee_id
      ? asId(payload.assigned_by_employee_id, "Assigned by employee id")
      : originType === "system"
        ? null
        : actorEmployeeId;

    return {
      title: requireValue(payload, "title", "Task title"),
      description: normalizeNullableText(payload.description),
      status: "open",
      priority,
      severity,
      origin_type: originType,
      origin_label:
        normalizeNullableText(payload.origin_label) ||
        (originType === "system"
          ? "System Generated"
          : originType === "self"
            ? "Self Created"
            : "Assigned by Authority"),
      system_rule_code: normalizeNullableText(payload.system_rule_code),
      module_key: normalizeNullableText(payload.module_key),
      entity_type: normalizeNullableText(payload.entity_type),
      entity_id: normalizeNullableText(payload.entity_id),
      linked_reference: normalizeNullableText(payload.linked_reference),
      linked_url: normalizeNullableText(payload.linked_url),
      due_at: toDateOrNull(payload.due_at, "Due date"),
      reminder_at: toDateOrNull(payload.reminder_at, "Reminder date"),
      reminder_sound: normalizeNullableText(payload.reminder_sound) || "soft_bell",
      repeat_rule: normalizeNullableText(payload.repeat_rule),
      tags_json: normalizeArray(payload.tags),
      checklist_json: normalizeArray(payload.checklist),
      created_by_employee_id: payload.created_by_employee_id
        ? asId(payload.created_by_employee_id, "Created by employee id")
        : actorEmployeeId,
      created_by_name: normalizeNullableText(payload.created_by_name) || actorName,
      assigned_by_employee_id: assignedByEmployeeId,
      assigned_by_name:
        normalizeNullableText(payload.assigned_by_name) ||
        (originType === "system" ? "System" : actorName),
      last_activity_at: new Date(),
    };
  }

  normalizeAssignees(payload = {}, actor = {}) {
    const fromArray = Array.isArray(payload.assignees) ? payload.assignees : [];
    const fromSingle = payload.assigned_to_employee_id
      ? [
          {
            assigned_to_employee_id: payload.assigned_to_employee_id,
            assigned_to_name: payload.assigned_to_name,
          },
        ]
      : [];
    const rawAssignees = fromArray.length ? fromArray : fromSingle;

    if (!rawAssignees.length && actor.employee_id) {
      rawAssignees.push({
        assigned_to_employee_id: actor.employee_id,
        assigned_to_name: displayNameFromActor(actor),
      });
    }

    return rawAssignees
      .map((assignee) => ({
        assigned_to_employee_id: assignee.assigned_to_employee_id
          ? asId(assignee.assigned_to_employee_id, "Assigned to employee id")
          : null,
        assigned_to_name: normalizeNullableText(assignee.assigned_to_name),
        status: "open",
      }))
      .filter((assignee) => assignee.assigned_to_employee_id || assignee.assigned_to_name);
  }

  async createTask(payload = {}, actor = {}) {
    const taskPayload = this.normalizeTaskPayload(payload, actor);
    const assignees = this.normalizeAssignees(payload, actor);

    return sequelize.transaction(async (transaction) => {
      const task = await this.repository.createTask(taskPayload, transaction);
      await this.repository.createAssignees(
        assignees.map((assignee) => ({ ...assignee, work_task_id: task.id })),
        transaction,
      );
      await this.repository.createActivity(
        {
          work_task_id: task.id,
          action_type: "created",
          to_status: "open",
          remarks: task.origin_label,
          actor_employee_id: task.created_by_employee_id,
          actor_name: task.created_by_name,
          metadata_json: {
            origin_type: task.origin_type,
            module_key: task.module_key,
            entity_id: task.entity_id,
          },
        },
        transaction,
      );

      return this.repository.findTaskById(task.id, transaction);
    });
  }

  async listTasks(query = {}) {
    const where = {};
    const status = normalizeNullableText(query.status);
    if (status && status !== "all") {
      if (status === "active") {
        where.status = { [Op.in]: ["open", "in_progress", "returned", "reassigned"] };
      } else {
        where.status = status;
      }
    }
    if (query.priority) where.priority = toSnake(query.priority);
    if (query.origin_type) where.origin_type = toSnake(query.origin_type);
    if (query.module_key) where.module_key = normalizeText(query.module_key);
    if (query.entity_type) where.entity_type = normalizeText(query.entity_type);
    if (query.entity_id) where.entity_id = normalizeText(query.entity_id);

    const assigneeEmployeeId = query.assigned_to_employee_id || query.employee_id
      ? asId(query.assigned_to_employee_id || query.employee_id, "Employee id")
      : null;

    return this.repository.listTasks({
      where,
      assigneeEmployeeId,
      from: toDateOrNull(query.from, "From date"),
      to: toDateOrNull(query.to, "To date"),
      limit: Number(query.limit || 300),
    });
  }

  async getTaskById(id) {
    const task = await this.repository.findTaskById(asId(id, "Task id"));
    if (!task) throw notFound("Task not found.");
    return task;
  }

  async updateStatus(id, status, payload = {}, actor = {}) {
    const nextStatus = toSnake(status, "open");
    if (!TASK_STATUSES.has(nextStatus)) {
      const error = new Error("Invalid task status.");
      error.statusCode = 400;
      throw error;
    }

    const actorEmployeeId = actor.employee_id ? asId(actor.employee_id, "Actor employee id") : null;
    const actorName = displayNameFromActor(actor);

    return sequelize.transaction(async (transaction) => {
      const task = await this.repository.findTaskById(asId(id, "Task id"), transaction);
      if (!task) throw notFound("Task not found.");
      const previousStatus = task.status;
      const now = new Date();
      const patch = {
        status: nextStatus,
        last_activity_at: now,
      };

      if (nextStatus === "completed") {
        patch.completed_at = now;
        patch.completed_by_employee_id = actorEmployeeId;
      }

      await this.repository.updateTask(task, patch, transaction);
      await this.repository.updateAssignees(
        task.id,
        {
          status: nextStatus,
          completed_at: nextStatus === "completed" ? now : null,
        },
        transaction,
      );
      await this.repository.createActivity(
        {
          work_task_id: task.id,
          action_type: nextStatus,
          from_status: previousStatus,
          to_status: nextStatus,
          remarks: normalizeNullableText(payload.remarks),
          actor_employee_id: actorEmployeeId,
          actor_name: actorName,
          metadata_json: {},
        },
        transaction,
      );

      return this.repository.findTaskById(task.id, transaction);
    });
  }

  async returnTask(id, payload = {}, actor = {}) {
    const remarks = requireValue(payload, "remarks", "Return remarks");
    const reason = normalizeNullableText(payload.reason) || "Need clarification";
    const actorEmployeeId = actor.employee_id ? asId(actor.employee_id, "Actor employee id") : null;
    const actorName = displayNameFromActor(actor);

    return sequelize.transaction(async (transaction) => {
      const task = await this.repository.findTaskById(asId(id, "Task id"), transaction);
      if (!task) throw notFound("Task not found.");
      const previousStatus = task.status;
      const now = new Date();

      await this.repository.updateTask(
        task,
        {
          status: "returned",
          returned_at: now,
          returned_by_employee_id: actorEmployeeId,
          return_reason: reason,
          return_remarks: remarks,
          last_activity_at: now,
        },
        transaction,
      );
      await this.repository.updateAssignees(
        task.id,
        { status: "returned", returned_at: now },
        transaction,
      );
      await this.repository.createComment(
        {
          work_task_id: task.id,
          comment_type: "return",
          comment_text: remarks,
          author_employee_id: actorEmployeeId,
          author_name: actorName,
        },
        transaction,
      );
      await this.repository.createActivity(
        {
          work_task_id: task.id,
          action_type: "returned",
          from_status: previousStatus,
          to_status: "returned",
          remarks,
          actor_employee_id: actorEmployeeId,
          actor_name: actorName,
          metadata_json: { reason },
        },
        transaction,
      );

      return this.repository.findTaskById(task.id, transaction);
    });
  }

  async addComment(id, payload = {}, actor = {}) {
    const actorEmployeeId = actor.employee_id ? asId(actor.employee_id, "Actor employee id") : null;
    const actorName = displayNameFromActor(actor);

    return sequelize.transaction(async (transaction) => {
      const task = await this.repository.findTaskById(asId(id, "Task id"), transaction);
      if (!task) throw notFound("Task not found.");
      await this.repository.createComment(
        {
          work_task_id: task.id,
          comment_type: normalizeNullableText(payload.comment_type) || "comment",
          comment_text: requireValue(payload, "comment_text", "Comment"),
          author_employee_id: actorEmployeeId,
          author_name: actorName,
        },
        transaction,
      );
      await this.repository.createActivity(
        {
          work_task_id: task.id,
          action_type: "commented",
          remarks: normalizeNullableText(payload.comment_text),
          actor_employee_id: actorEmployeeId,
          actor_name: actorName,
          metadata_json: {},
        },
        transaction,
      );
      return this.repository.findTaskById(task.id, transaction);
    });
  }
}

module.exports = WorkTaskService;
