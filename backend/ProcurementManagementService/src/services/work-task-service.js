const { Op } = require("sequelize");
const {
  ApprovalRequest,
  ApprovalRequestStep,
  CommitteeMeeting,
  PbgEntry,
  ProcurementEmployee,
  Tender,
  TenderEmdEntry,
  WorkTask,
  sequelize,
} = require("../../models");
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
const REMINDER_FREQUENCIES = new Set([
  "once",
  "every_15_minutes",
  "hourly",
  "every_2_hours",
  "every_6_hours",
  "every_12_hours",
  "every_5_days",
  "daily",
  "weekly",
]);
const TASK_REPEAT_RULES = new Set([
  "daily",
  "weekly",
  "monthly",
]);
const REMINDER_UPDATE_FIELDS = new Set(["reminder_at", "reminder_sound", "reminder_frequency"]);
const PROGRESS_UPDATE_FIELDS = new Set(["checklist_json"]);
const ACTIVE_TASK_STATUSES = new Set(["open", "in_progress", "returned", "reassigned"]);
const REMINDER_OCCURRENCE_RULE_CODE = "task_reminder_occurrence";
const REMINDER_OCCURRENCE_ENTITY_TYPE = "work_task_reminder";
const MAX_REMINDER_OCCURRENCE_TASKS = 96;
const SHORT_REMINDER_OCCURRENCE_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const REMINDER_FREQUENCY_INTERVAL_MS = {
  every_15_minutes: 15 * 60 * 1000,
  hourly: 60 * 60 * 1000,
  every_2_hours: 2 * 60 * 60 * 1000,
  every_6_hours: 6 * 60 * 60 * 1000,
  every_12_hours: 12 * 60 * 60 * 1000,
  every_5_days: 5 * 24 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};
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

const normalizeDigits = (value) => String(value || "").replace(/\D/g, "").trim();

const normalizeIdentityName = (value) =>
  normalizeNullableText(value)?.replace(/\s+/g, " ").toLowerCase() || null;

const normalizeRepeatRule = (value) => {
  const repeatRule = toSnake(value, "");
  if (!repeatRule) return null;
  if (!TASK_REPEAT_RULES.has(repeatRule)) {
    const error = new Error("Invalid task repeat rule.");
    error.statusCode = 400;
    throw error;
  }
  return repeatRule;
};

const getSeverityForPriority = (priority) => {
  if (priority === "critical") return "critical";
  if (priority === "high") return "urgent";
  return "normal";
};

const normalizeActorRoles = (actor = {}) =>
  normalizeArray(actor.roles).map((role) => String(role || "").trim().toUpperCase()).filter(Boolean);

const isAdminActor = (actor = {}) => {
  const roles = normalizeActorRoles(actor);
  return roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
};

const isActorAssignedToTask = (task, actorEmployeeId) => {
  if (!actorEmployeeId) return false;
  return (task.assignees || []).some(
    (assignee) => String(assignee.assigned_to_employee_id || "") === String(actorEmployeeId),
  );
};

const canFullyEditTask = (task, actor = {}) => {
  const actorEmployeeId = actor.employee_id ? asId(actor.employee_id, "Actor employee id") : null;
  if (task.origin_type === "system") return false;
  if (isAdminActor(actor)) return true;
  return task.origin_type === "self" && String(task.created_by_employee_id || "") === String(actorEmployeeId || "");
};

const canEditTaskReminder = (task, actor = {}) => {
  const actorEmployeeId = actor.employee_id ? asId(actor.employee_id, "Actor employee id") : null;
  if (task.origin_type === "system") return false;
  if (canFullyEditTask(task, actor)) return true;
  if (!actorEmployeeId) return false;
  return (
    isActorAssignedToTask(task, actorEmployeeId) ||
    String(task.assigned_by_employee_id || "") === String(actorEmployeeId) ||
    String(task.created_by_employee_id || "") === String(actorEmployeeId)
  );
};

const requireTaskEditPermission = (task, patch, actor = {}) => {
  if (task.origin_type === "system") {
    const error = new Error("System-generated tasks cannot be edited from My Work.");
    error.statusCode = 403;
    throw error;
  }

  const patchFields = Object.keys(patch);
  if (canFullyEditTask(task, actor)) return;

  const reminderOnly = patchFields.every((field) => REMINDER_UPDATE_FIELDS.has(field));
  if (reminderOnly && canEditTaskReminder(task, actor)) return;
  const progressOnly = patchFields.every((field) => PROGRESS_UPDATE_FIELDS.has(field));
  if (progressOnly && canEditTaskReminder(task, actor)) return;

  const error = new Error(
    reminderOnly
      ? "You can edit reminders only for tasks assigned to you."
      : "Only self-created tasks can be edited. Assigned and system tasks allow reminder and checklist updates only.",
  );
  error.statusCode = 403;
  throw error;
};

const requireSystemTaskActionAllowed = (task) => {
  if (task.origin_type !== "system") return;
  const error = new Error("System-generated tasks are read-only. Open the linked module to resolve the source item.");
  error.statusCode = 403;
  throw error;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const startOfToday = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

const endOfDay = (date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const toDateOnly = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const fromDateOnly = (value, hour = 17) => {
  if (!value) return null;
  const date = new Date(`${value}T${String(hour).padStart(2, "0")}:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseTimeParts = (value) => {
  const text = normalizeNullableText(value);
  if (!text) return null;
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3]?.toUpperCase();
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "PM" && hour !== 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }

  return { hour, minute };
};

const fromCommitteeMeetingDateTime = (meeting = {}) => {
  if (!meeting.meeting_date) return null;
  const time = parseTimeParts(meeting.meeting_time) || { hour: 10, minute: 0 };
  const date = new Date(
    `${meeting.meeting_date}T${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}:00`,
  );
  return Number.isNaN(date.getTime()) ? null : date;
};

const getTenderReference = (tender = {}) =>
  normalizeNullableText(tender.portal_bid_no) ||
  normalizeNullableText(tender.tender_reference_no) ||
  normalizeNullableText(tender.portal_tender_id) ||
  (tender.id ? `Tender #${tender.id}` : "Tender");

const getSystemAssignee = (row = {}) => {
  const employeeId = row.updated_by || row.created_by || row.requested_by_employee_id || null;
  if (!employeeId) return {};
  return {
    assigned_to_employee_id: employeeId,
    assigned_to_name: "Responsible Officer",
  };
};

const getNextRecurringDate = (value, repeatRule) => {
  if (!value || !repeatRule) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  if (repeatRule === "daily") date.setDate(date.getDate() + 1);
  else if (repeatRule === "weekly") date.setDate(date.getDate() + 7);
  else if (repeatRule === "monthly") date.setMonth(date.getMonth() + 1);
  else return null;

  return date;
};

const shiftDateByDelta = (value, deltaMs) => {
  if (!value || !Number.isFinite(deltaMs)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + deltaMs);
};

const isSameMinute = (first, second) => {
  if (!first || !second) return false;
  return Math.floor(first.getTime() / 60000) === Math.floor(second.getTime() / 60000);
};

const isRollingReminderFrequency = (frequency) => {
  const intervalMs = REMINDER_FREQUENCY_INTERVAL_MS[frequency];
  return Boolean(intervalMs && intervalMs < SHORT_REMINDER_OCCURRENCE_THRESHOLD_MS);
};

const getReminderOccurrenceEntityId = (task, occurrenceAt) => {
  if (isRollingReminderFrequency(task.reminder_frequency || "once")) {
    return `${task.id}:rolling`;
  }
  return `${task.id}:${occurrenceAt.toISOString()}`;
};

const getNextReminderOccurrence = ({ reminderAt, dueAt, intervalMs, now = new Date() }) => {
  if (!intervalMs || !reminderAt) return null;
  if (dueAt && now >= dueAt) return null;
  if (now <= reminderAt) return reminderAt;

  const elapsed = now.getTime() - reminderAt.getTime();
  const steps = Math.ceil(elapsed / intervalMs);
  const next = new Date(reminderAt.getTime() + steps * intervalMs);
  if (dueAt && next >= dueAt) return null;
  return next;
};

const buildReminderOccurrences = (task = {}) => {
  if (!task?.id || task.system_rule_code === REMINDER_OCCURRENCE_RULE_CODE) return [];
  if (!ACTIVE_TASK_STATUSES.has(task.status)) return [];

  const reminderAt = task.reminder_at ? new Date(task.reminder_at) : null;
  if (!reminderAt || Number.isNaN(reminderAt.getTime())) return [];

  const dueAt = task.due_at ? new Date(task.due_at) : null;
  const hasValidDueAt = dueAt && !Number.isNaN(dueAt.getTime());
  const frequency = task.reminder_frequency || "once";
  const intervalMs = REMINDER_FREQUENCY_INTERVAL_MS[frequency];

  if (!intervalMs || !hasValidDueAt || dueAt <= reminderAt) {
    return isSameMinute(reminderAt, dueAt) ? [] : [reminderAt];
  }

  if (intervalMs < SHORT_REMINDER_OCCURRENCE_THRESHOLD_MS) {
    const nextOccurrence = getNextReminderOccurrence({ reminderAt, dueAt, intervalMs });
    return nextOccurrence && !isSameMinute(nextOccurrence, dueAt) ? [nextOccurrence] : [];
  }

  const occurrences = [];
  let cursor = getNextReminderOccurrence({ reminderAt, dueAt, intervalMs }) || new Date(reminderAt);
  while (cursor < dueAt && occurrences.length < MAX_REMINDER_OCCURRENCE_TASKS) {
    if (!isSameMinute(cursor, dueAt)) {
      occurrences.push(new Date(cursor));
    }
    cursor = new Date(cursor.getTime() + intervalMs);
  }
  return occurrences;
};

const normalizeChecklistForRecurrence = (value) =>
  normalizeArray(value).map((item) => {
    if (typeof item === "string") return { text: item, done: false };
    return {
      ...item,
      done: false,
      completed: false,
    };
  });

class WorkTaskService {
  constructor() {
    this.repository = new WorkTaskRepository();
  }

  async resolveActorIdentity(actor = {}) {
    const actorEmployeeId = actor.employee_id ? asId(actor.employee_id, "Actor employee id") : null;
    const actorEmpcode = normalizeNullableText(actor.empcode || actor.emp_code);
    const actorMobileNo = normalizeDigits(actor.mobile_no || actor.mobileno);
    const actorName = displayNameFromActor(actor);
    const normalizedActorName = normalizeIdentityName(actorName);

    let employee = null;
    if (actorEmployeeId) {
      employee = await ProcurementEmployee.findByPk(actorEmployeeId);
    }
    if (!employee && actorEmpcode && actorMobileNo) {
      employee = await ProcurementEmployee.findOne({
        where: { empcode: actorEmpcode, mobile_no: actorMobileNo, is_active: true },
      });
    }
    if (!employee && actorEmpcode) {
      employee = await ProcurementEmployee.findOne({
        where: { empcode: actorEmpcode, is_active: true },
      });
    }
    if (!employee && actorMobileNo) {
      employee = await ProcurementEmployee.findOne({
        where: { mobile_no: actorMobileNo, is_active: true },
      });
    }
    if (!employee && normalizedActorName) {
      const nameMatches = await ProcurementEmployee.findAll({
        where: {
          is_active: true,
          [Op.and]: [
            sequelize.where(
              sequelize.fn("LOWER", sequelize.fn("TRIM", sequelize.col("employee_name"))),
              normalizedActorName,
            ),
          ],
        },
        limit: 2,
      });
      if (nameMatches.length === 1) {
        employee = nameMatches[0];
      }
    }

    if (!employee) return actor;

    return {
      ...actor,
      employee_id: employee.id,
      empcode: employee.empcode,
      mobile_no: employee.mobile_no,
      name: employee.employee_name || displayNameFromActor(actor),
      employee_name: employee.employee_name || actor.employee_name,
    };
  }

  async resolveReminderAssignees(task = {}) {
    const rawAssignees = (task.assignees || [])
      .map((assignee) => ({
        assigned_to_employee_id: assignee.assigned_to_employee_id,
        assigned_to_name:
          assignee.assigned_to_name ||
          assignee.assigned_to_employee?.employee_name ||
          null,
      }))
      .filter((assignee) => assignee.assigned_to_employee_id || assignee.assigned_to_name);

    if (!rawAssignees.length && (task.created_by_employee_id || task.created_by_name)) {
      rawAssignees.push({
        assigned_to_employee_id: task.created_by_employee_id,
        assigned_to_name: task.created_by_name,
      });
    }

    if (!rawAssignees.length && (task.assigned_by_employee_id || task.assigned_by_name)) {
      rawAssignees.push({
        assigned_to_employee_id: task.assigned_by_employee_id,
        assigned_to_name: task.assigned_by_name,
      });
    }

    const resolvedAssignees = [];
    const seen = new Set();

    for (const assignee of rawAssignees) {
      const resolved = assignee.assigned_to_employee_id
        ? assignee
        : await this.resolveActorIdentity({ name: assignee.assigned_to_name });
      const normalized = {
        assigned_to_employee_id: resolved.employee_id || assignee.assigned_to_employee_id || null,
        assigned_to_name:
          resolved.employee_name ||
          resolved.name ||
          assignee.assigned_to_name ||
          null,
      };
      const key = normalized.assigned_to_employee_id
        ? `id:${normalized.assigned_to_employee_id}`
        : `name:${normalized.assigned_to_name}`;
      if (!normalized.assigned_to_employee_id && !normalized.assigned_to_name) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      resolvedAssignees.push(normalized);
    }

    return resolvedAssignees;
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

    const severity = getSeverityForPriority(priority);
    const reminderFrequency = toSnake(payload.reminder_frequency, "once");
    if (!REMINDER_FREQUENCIES.has(reminderFrequency)) {
      const error = new Error("Invalid reminder frequency.");
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
      reminder_frequency: reminderFrequency,
      repeat_rule: normalizeRepeatRule(payload.repeat_rule),
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

  async syncReminderOccurrenceTasksForTask(task, transaction) {
    if (!task?.id || task.system_rule_code === REMINDER_OCCURRENCE_RULE_CODE) return;

    const occurrences = buildReminderOccurrences(task);
    const desiredEntityIds = new Set(
      occurrences.map((occurrenceAt) => getReminderOccurrenceEntityId(task, occurrenceAt)),
    );
    const existingOccurrences = await this.repository.findReminderOccurrenceTasks(task.id, transaction);

    for (const existing of existingOccurrences) {
      if (!desiredEntityIds.has(existing.entity_id)) {
        await this.repository.updateTask(
          existing,
          {
            status: "cancelled",
            last_activity_at: new Date(),
          },
          transaction,
        );
        await this.repository.updateAssignees(
          existing.id,
          { status: "cancelled" },
          transaction,
        );
        await this.repository.createActivity(
          {
            work_task_id: existing.id,
            action_type: "cancelled",
            from_status: existing.status,
            to_status: "cancelled",
            remarks: `Reminder occurrence no longer matches task #${task.id}.`,
            actor_employee_id: null,
            actor_name: "System",
            metadata_json: { source_task_id: task.id },
          },
          transaction,
        );
      }
    }

    for (const occurrenceAt of occurrences) {
      const entityId = getReminderOccurrenceEntityId(task, occurrenceAt);
      const assignees = await this.resolveReminderAssignees(task);

      await this.createOrUpdateSystemTask(
        {
          title: `Reminder: ${task.title}`,
          description: [
            `Reminder generated from task #${task.id}.`,
            task.description,
          ]
            .filter(Boolean)
            .join(" "),
          origin_type: "system",
          origin_label: "System Reminder",
          system_rule_code: REMINDER_OCCURRENCE_RULE_CODE,
          module_key: task.module_key,
          entity_type: REMINDER_OCCURRENCE_ENTITY_TYPE,
          entity_id: entityId,
          linked_reference: task.linked_reference || task.title,
          linked_url: task.linked_url,
          due_at: occurrenceAt,
          reminder_at: null,
          reminder_sound: task.reminder_sound || "soft_bell",
          reminder_frequency: "once",
          priority: task.priority || "medium",
          assignees,
          created_by_employee_id: task.created_by_employee_id,
          created_by_name: task.created_by_name,
          assigned_by_employee_id: task.assigned_by_employee_id,
          assigned_by_name: task.assigned_by_name || "System",
        },
        transaction,
      );
    }
  }

  async createTask(payload = {}, actor = {}) {
    const resolvedActor = await this.resolveActorIdentity(actor);
    const taskPayload = this.normalizeTaskPayload(payload, resolvedActor);
    const assignees = this.normalizeAssignees(payload, resolvedActor);

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

      const createdTask = await this.repository.findTaskById(task.id, transaction);
      await this.syncReminderOccurrenceTasksForTask(createdTask, transaction);
      return this.repository.findTaskById(task.id, transaction);
    });
  }

  async syncReminderOccurrences() {
    const result = { scanned: 0 };

    return sequelize.transaction(async (transaction) => {
      const reminderSourceTasks = await this.repository.findActiveReminderSourceTasks(transaction);
      for (const task of reminderSourceTasks) {
        result.scanned += 1;
        await this.syncReminderOccurrenceTasksForTask(task, transaction);
      }
      return result;
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
    if (query.completed_by_employee_id) {
      where.completed_by_employee_id = asId(query.completed_by_employee_id, "Completed by employee id");
    }

    const assigneeEmployeeId = query.assigned_to_employee_id
      ? asId(query.assigned_to_employee_id, "Assigned to employee id")
      : null;
    const participantEmployeeId = query.employee_id
      ? asId(query.employee_id, "Employee id")
      : null;
    return this.repository.listTasks({
      where,
      assigneeEmployeeId,
      participantEmployeeId,
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

  normalizeTaskPatchPayload(payload = {}) {
    const patch = {};

    if (Object.prototype.hasOwnProperty.call(payload, "title")) {
      patch.title = requireValue(payload, "title", "Task title");
    }
    if (Object.prototype.hasOwnProperty.call(payload, "description")) {
      patch.description = normalizeNullableText(payload.description);
    }
    if (Object.prototype.hasOwnProperty.call(payload, "priority")) {
      const priority = toSnake(payload.priority, "medium");
      if (!PRIORITIES.has(priority)) {
        const error = new Error("Invalid task priority.");
        error.statusCode = 400;
        throw error;
      }
      patch.priority = priority;
      patch.severity = getSeverityForPriority(priority);
    }
    if (Object.prototype.hasOwnProperty.call(payload, "due_at")) {
      patch.due_at = toDateOrNull(payload.due_at, "Due date");
    }
    if (Object.prototype.hasOwnProperty.call(payload, "reminder_at")) {
      patch.reminder_at = toDateOrNull(payload.reminder_at, "Reminder date");
    }
    if (Object.prototype.hasOwnProperty.call(payload, "reminder_sound")) {
      patch.reminder_sound = normalizeNullableText(payload.reminder_sound) || "soft_bell";
    }
    if (Object.prototype.hasOwnProperty.call(payload, "reminder_frequency")) {
      const reminderFrequency = toSnake(payload.reminder_frequency, "once");
      if (!REMINDER_FREQUENCIES.has(reminderFrequency)) {
        const error = new Error("Invalid reminder frequency.");
        error.statusCode = 400;
        throw error;
      }
      patch.reminder_frequency = reminderFrequency;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "repeat_rule")) {
      patch.repeat_rule = normalizeRepeatRule(payload.repeat_rule);
    }
    if (Object.prototype.hasOwnProperty.call(payload, "tags")) {
      patch.tags_json = normalizeArray(payload.tags);
    }
    if (Object.prototype.hasOwnProperty.call(payload, "checklist")) {
      patch.checklist_json = normalizeArray(payload.checklist);
    }
    if (Object.prototype.hasOwnProperty.call(payload, "module_key")) {
      patch.module_key = normalizeNullableText(payload.module_key);
    }
    if (Object.prototype.hasOwnProperty.call(payload, "entity_type")) {
      patch.entity_type = normalizeNullableText(payload.entity_type);
    }
    if (Object.prototype.hasOwnProperty.call(payload, "entity_id")) {
      patch.entity_id = normalizeNullableText(payload.entity_id);
    }
    if (Object.prototype.hasOwnProperty.call(payload, "linked_reference")) {
      patch.linked_reference = normalizeNullableText(payload.linked_reference);
    }
    if (Object.prototype.hasOwnProperty.call(payload, "linked_url")) {
      patch.linked_url = normalizeNullableText(payload.linked_url);
    }

    return patch;
  }

  async updateTask(id, payload = {}, actor = {}) {
    const patch = this.normalizeTaskPatchPayload(payload);
    if (!Object.keys(patch).length) {
      const error = new Error("No task fields supplied for update.");
      error.statusCode = 400;
      throw error;
    }

    const actorEmployeeId = actor.employee_id ? asId(actor.employee_id, "Actor employee id") : null;
    const actorName = displayNameFromActor(actor);

    return sequelize.transaction(async (transaction) => {
      const task = await this.repository.findTaskById(asId(id, "Task id"), transaction);
      if (!task) throw notFound("Task not found.");
      requireTaskEditPermission(task, patch, actor);

      await this.repository.updateTask(
        task,
        {
          ...patch,
          last_activity_at: new Date(),
        },
        transaction,
      );
      await this.repository.createActivity(
        {
          work_task_id: task.id,
          action_type: Object.keys(patch).every((field) => REMINDER_UPDATE_FIELDS.has(field))
            ? "reminder_updated"
            : "updated",
          remarks: normalizeNullableText(payload.remarks) || "Task updated.",
          actor_employee_id: actorEmployeeId,
          actor_name: actorName,
          metadata_json: { updated_fields: Object.keys(patch) },
        },
        transaction,
      );

      const updatedTask = await this.repository.findTaskById(task.id, transaction);
      await this.syncReminderOccurrenceTasksForTask(updatedTask, transaction);
      return this.repository.findTaskById(task.id, transaction);
    });
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
      requireSystemTaskActionAllowed(task);
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

      if (nextStatus === "completed" && task.repeat_rule) {
        const nextDueAt = getNextRecurringDate(task.due_at, task.repeat_rule);
        if (nextDueAt) {
          const originalDueAt = new Date(task.due_at);
          const reminderDelta = nextDueAt.getTime() - originalDueAt.getTime();
          const nextReminderAt = shiftDateByDelta(task.reminder_at, reminderDelta);
          const nextTask = await this.repository.createTask(
            {
              title: task.title,
              description: task.description,
              status: "open",
              priority: task.priority,
              severity: task.severity,
              origin_type: task.origin_type,
              origin_label: task.origin_label,
              system_rule_code: task.system_rule_code,
              module_key: task.module_key,
              entity_type: task.entity_type,
              entity_id: task.entity_id,
              linked_reference: task.linked_reference,
              linked_url: task.linked_url,
              due_at: nextDueAt,
              reminder_at: nextReminderAt,
              reminder_sound: task.reminder_sound,
              reminder_frequency: task.reminder_frequency || "once",
              repeat_rule: task.repeat_rule,
              tags_json: task.tags_json,
              checklist_json: normalizeChecklistForRecurrence(task.checklist_json),
              created_by_employee_id: task.created_by_employee_id,
              created_by_name: task.created_by_name,
              assigned_by_employee_id: task.assigned_by_employee_id,
              assigned_by_name: task.assigned_by_name,
              last_activity_at: now,
            },
            transaction,
          );
          const nextAssignees = (task.assignees || []).map((assignee) => ({
            work_task_id: nextTask.id,
            assigned_to_employee_id: assignee.assigned_to_employee_id,
            assigned_to_name: assignee.assigned_to_name,
            status: "open",
          }));
          await this.repository.createAssignees(nextAssignees, transaction);
          await this.repository.createActivity(
            {
              work_task_id: nextTask.id,
              action_type: "recurring_created",
              to_status: "open",
              remarks: `Created from recurring task #${task.id}.`,
              actor_employee_id: actorEmployeeId,
              actor_name: actorName,
              metadata_json: { source_task_id: task.id, repeat_rule: task.repeat_rule },
            },
            transaction,
          );
          const recurringTask = await this.repository.findTaskById(nextTask.id, transaction);
          await this.syncReminderOccurrenceTasksForTask(recurringTask, transaction);
        }
      }

      const updatedTask = await this.repository.findTaskById(task.id, transaction);
      await this.syncReminderOccurrenceTasksForTask(updatedTask, transaction);
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
      requireSystemTaskActionAllowed(task);
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

      const updatedTask = await this.repository.findTaskById(task.id, transaction);
      await this.syncReminderOccurrenceTasksForTask(updatedTask, transaction);
      return this.repository.findTaskById(task.id, transaction);
    });
  }

  async snoozeTask(id, payload = {}, actor = {}) {
    const reminderAt = toDateOrNull(payload.reminder_at, "Snooze reminder date");
    if (!reminderAt) {
      const error = new Error("Snooze reminder date is required.");
      error.statusCode = 400;
      throw error;
    }

    const actorEmployeeId = actor.employee_id ? asId(actor.employee_id, "Actor employee id") : null;
    const actorName = displayNameFromActor(actor);

    return sequelize.transaction(async (transaction) => {
      const task = await this.repository.findTaskById(asId(id, "Task id"), transaction);
      if (!task) throw notFound("Task not found.");
      requireSystemTaskActionAllowed(task);

      await this.repository.updateTask(
        task,
        {
          reminder_at: reminderAt,
          last_activity_at: new Date(),
        },
        transaction,
      );
      await this.repository.createActivity(
        {
          work_task_id: task.id,
          action_type: "snoozed",
          remarks: normalizeNullableText(payload.remarks) || "Reminder snoozed.",
          actor_employee_id: actorEmployeeId,
          actor_name: actorName,
          metadata_json: { reminder_at: reminderAt },
        },
        transaction,
      );

      const updatedTask = await this.repository.findTaskById(task.id, transaction);
      await this.syncReminderOccurrenceTasksForTask(updatedTask, transaction);
      return this.repository.findTaskById(task.id, transaction);
    });
  }

  async reassignTask(id, payload = {}, actor = {}) {
    const assignees = this.normalizeAssignees(payload, actor);
    if (!assignees.length) {
      const error = new Error("New assignee is required.");
      error.statusCode = 400;
      throw error;
    }

    const actorEmployeeId = actor.employee_id ? asId(actor.employee_id, "Actor employee id") : null;
    const actorName = displayNameFromActor(actor);

    return sequelize.transaction(async (transaction) => {
      const task = await this.repository.findTaskById(asId(id, "Task id"), transaction);
      if (!task) throw notFound("Task not found.");
      requireSystemTaskActionAllowed(task);
      const previousStatus = task.status;
      const now = new Date();

      await this.repository.updateAssignees(
        task.id,
        {
          status: "reassigned",
          returned_at: now,
        },
        transaction,
      );
      await this.repository.createAssignees(
        assignees.map((assignee) => ({ ...assignee, work_task_id: task.id })),
        transaction,
      );
      await this.repository.updateTask(
        task,
        {
          status: "reassigned",
          assigned_by_employee_id: actorEmployeeId,
          assigned_by_name: actorName,
          last_activity_at: now,
        },
        transaction,
      );
      await this.repository.createActivity(
        {
          work_task_id: task.id,
          action_type: "reassigned",
          from_status: previousStatus,
          to_status: "reassigned",
          remarks: normalizeNullableText(payload.remarks) || "Task reassigned.",
          actor_employee_id: actorEmployeeId,
          actor_name: actorName,
          metadata_json: { assignee_count: assignees.length },
        },
        transaction,
      );

      return this.repository.findTaskById(task.id, transaction);
    });
  }

  async addAttachment(id, payload = {}, actor = {}) {
    const documentPath = requireValue(payload, "document_path", "Attachment document path");
    const actorEmployeeId = actor.employee_id ? asId(actor.employee_id, "Actor employee id") : null;
    const actorName = displayNameFromActor(actor);

    return sequelize.transaction(async (transaction) => {
      const task = await this.repository.findTaskById(asId(id, "Task id"), transaction);
      if (!task) throw notFound("Task not found.");
      requireSystemTaskActionAllowed(task);

      await this.repository.createAttachment(
        {
          work_task_id: task.id,
          document_path: documentPath,
          original_file_name: normalizeNullableText(payload.original_file_name || payload.originalName),
          file_size: payload.file_size || payload.size || null,
          mime_type: normalizeNullableText(payload.mime_type || payload.mimeType),
          remarks: normalizeNullableText(payload.remarks),
          uploaded_by_employee_id: actorEmployeeId,
          uploaded_by_name: actorName,
        },
        transaction,
      );
      await this.repository.createActivity(
        {
          work_task_id: task.id,
          action_type: "attachment_added",
          remarks: normalizeNullableText(payload.remarks) || "Attachment added.",
          actor_employee_id: actorEmployeeId,
          actor_name: actorName,
          metadata_json: { document_path: documentPath },
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
      requireSystemTaskActionAllowed(task);
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

  async findEscalationOwner(task, transaction) {
    if (task.assigned_by_employee_id) {
      const assigner = await ProcurementEmployee.findByPk(task.assigned_by_employee_id, { transaction });
      if (assigner) {
        return {
          employee_id: assigner.id,
          name: assigner.employee_name,
        };
      }
    }

    const admin = await ProcurementEmployee.findOne({
      where: {
        is_active: true,
        assigned_roles: {
          [Op.or]: [{ [Op.like]: "%super_admin%" }, { [Op.like]: "%admin%" }],
        },
      },
      order: [["id", "ASC"]],
      transaction,
    });

    if (!admin) return null;
    return {
      employee_id: admin.id,
      name: admin.employee_name,
    };
  }

  async escalateOverdueTasks() {
    const now = new Date();
    const result = { escalated: 0, skipped: 0 };

    return sequelize.transaction(async (transaction) => {
      const overdueTasks = await this.repository.listTasks({
        where: {
          status: { [Op.in]: ["open", "in_progress", "returned", "reassigned"] },
          due_at: { [Op.lt]: now },
          escalation_status: { [Op.ne]: "escalated" },
        },
        limit: 500,
      });

      for (const task of overdueTasks) {
        const owner = await this.findEscalationOwner(task, transaction);
        if (!owner) {
          result.skipped += 1;
          continue;
        }

        const reason = `Task overdue since ${task.due_at ? new Date(task.due_at).toISOString() : "unknown due date"}.`;
        await this.repository.updateTask(
          task,
          {
            priority: "critical",
            severity: "critical",
            escalation_status: "escalated",
            escalated_at: now,
            escalated_to_employee_id: owner.employee_id,
            escalated_to_name: owner.name,
            escalation_reason: reason,
            last_activity_at: now,
          },
          transaction,
        );
        await this.repository.createComment(
          {
            work_task_id: task.id,
            comment_type: "system",
            comment_text: `Auto-escalated to ${owner.name}. ${reason}`,
            author_employee_id: null,
            author_name: "System",
          },
          transaction,
        );
        await this.repository.createActivity(
          {
            work_task_id: task.id,
            action_type: "escalated",
            remarks: reason,
            actor_employee_id: null,
            actor_name: "System",
            metadata_json: {
              escalated_to_employee_id: owner.employee_id,
              escalated_to_name: owner.name,
            },
          },
          transaction,
        );
        result.escalated += 1;
      }

      return result;
    });
  }

  async createOrUpdateSystemTask(payload = {}, transaction) {
    const existingTask = await this.repository.findActiveSystemTask(
      {
        systemRuleCode: payload.system_rule_code,
        entityType: payload.entity_type,
        entityId: payload.entity_id,
      },
      transaction,
    );

    if (existingTask) {
      await this.repository.updateTask(
        existingTask,
        {
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
          severity: getSeverityForPriority(payload.priority),
          module_key: payload.module_key,
          linked_reference: payload.linked_reference,
          linked_url: payload.linked_url,
          due_at: payload.due_at,
          reminder_at: payload.reminder_at ?? existingTask.reminder_at,
          reminder_sound: payload.reminder_sound || existingTask.reminder_sound || "soft_bell",
          reminder_frequency: payload.reminder_frequency || existingTask.reminder_frequency || "once",
          last_activity_at: new Date(),
        },
        transaction,
      );
      if (payload.assignees || payload.assigned_to_employee_id) {
        const assignees = this.normalizeAssignees(payload, {});
        await this.repository.replaceAssignees(existingTask.id, assignees, transaction);
      }
      const updatedTask = await this.repository.findTaskById(existingTask.id, transaction);
      await this.syncReminderOccurrenceTasksForTask(updatedTask, transaction);
      return { task: await this.repository.findTaskById(existingTask.id, transaction), created: false };
    }

    const taskPayload = this.normalizeTaskPayload(payload, {});
    const assignees = this.normalizeAssignees(payload, {});
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
        remarks: taskPayload.origin_label,
        actor_employee_id: null,
        actor_name: "System",
        metadata_json: {
          origin_type: "system",
          system_rule_code: taskPayload.system_rule_code,
          module_key: taskPayload.module_key,
          entity_id: taskPayload.entity_id,
        },
      },
      transaction,
    );
    const createdTask = await this.repository.findTaskById(task.id, transaction);
    await this.syncReminderOccurrenceTasksForTask(createdTask, transaction);
    return { task: await this.repository.findTaskById(task.id, transaction), created: true };
  }

  buildSystemTaskPayload({
    title,
    description,
    systemRuleCode,
    moduleKey,
    entityType,
    entityId,
    linkedReference,
    linkedUrl,
    dueAt,
    reminderAt,
    reminderFrequency = "once",
    priority = "high",
    assignee = {},
  }) {
    return {
      title,
      description,
      origin_type: "system",
      origin_label: "System Generated",
      system_rule_code: systemRuleCode,
      module_key: moduleKey,
      entity_type: entityType,
      entity_id: entityId,
      linked_reference: linkedReference,
      linked_url: linkedUrl,
      due_at: dueAt,
      reminder_at: reminderAt,
      reminder_frequency: reminderFrequency,
      priority,
      severity: getSeverityForPriority(priority),
      assigned_to_employee_id: assignee.assigned_to_employee_id,
      assigned_to_name: assignee.assigned_to_name,
    };
  }

  async syncSystemTasks() {
    const today = startOfToday();
    const now = new Date();
    const inThreeDays = endOfDay(addDays(today, 3));
    const inSevenDays = endOfDay(addDays(today, 7));
    const inThirtyDays = endOfDay(addDays(today, 30));
    const todayOnly = toDateOnly(today);
    const inSevenDaysOnly = toDateOnly(inSevenDays);
    const inThirtyDaysOnly = toDateOnly(inThirtyDays);
    const result = { created: 0, updated: 0, scanned: 0 };

    return sequelize.transaction(async (transaction) => {
      const saveSystemTask = async (payload) => {
        result.scanned += 1;
        const { created } = await this.createOrUpdateSystemTask(payload, transaction);
        if (created) result.created += 1;
        else result.updated += 1;
      };

      const [cancelledStaleCommitteeTasks] = await WorkTask.update(
        {
          status: "cancelled",
          last_activity_at: now,
        },
        {
          where: {
            origin_type: "system",
            system_rule_code: "committee_meeting_scheduled",
            status: { [Op.in]: Array.from(ACTIVE_TASK_STATUSES) },
            due_at: { [Op.lte]: now },
          },
          transaction,
        },
      );
      result.updated += cancelledStaleCommitteeTasks;

      const tenderDeadlineRows = await Tender.findAll({
        where: {
          current_submission_deadline: { [Op.between]: [today, inSevenDays] },
          status: { [Op.notIn]: ["cancelled", "closed"] },
        },
        transaction,
      });

      for (const tender of tenderDeadlineRows) {
        const reference = getTenderReference(tender);
        await saveSystemTask(
          this.buildSystemTaskPayload({
            title: `Tender submission deadline approaching: ${reference}`,
            description: "Review whether extension or final submission action is required.",
            systemRuleCode: "tender_submission_deadline",
            moduleKey: "tenders",
            entityType: "tender",
            entityId: tender.id,
            linkedReference: reference,
            linkedUrl: `/tenders/${tender.id}`,
            dueAt: tender.current_submission_deadline,
            reminderAt: addDays(new Date(tender.current_submission_deadline), -1),
            priority: "critical",
            severity: "critical",
            assignee: getSystemAssignee(tender),
          }),
        );
      }

      const tenderOpeningRows = await Tender.findAll({
        where: {
          bid_opening_date: { [Op.between]: [todayOnly, toDateOnly(inThreeDays)] },
          status: { [Op.notIn]: ["cancelled", "closed"] },
        },
        transaction,
      });

      for (const tender of tenderOpeningRows) {
        const reference = getTenderReference(tender);
        const dueAt = fromDateOnly(tender.bid_opening_date, 10);
        await saveSystemTask(
          this.buildSystemTaskPayload({
            title: `Tender opening pending: ${reference}`,
            description: "Prepare tender opening/commercial workflow action.",
            systemRuleCode: "tender_opening_pending",
            moduleKey: "tenders",
            entityType: "tender",
            entityId: tender.id,
            linkedReference: reference,
            linkedUrl: `/tenders/${tender.id}`,
            dueAt,
            reminderAt: dueAt ? addDays(dueAt, -1) : null,
            priority: "high",
            severity: "urgent",
            assignee: getSystemAssignee(tender),
          }),
        );
      }

      const priceValidityRows = await Tender.findAll({
        where: {
          price_bid_valid_upto: { [Op.between]: [todayOnly, inThirtyDaysOnly] },
          status: { [Op.notIn]: ["cancelled", "closed"] },
        },
        transaction,
      });

      for (const tender of priceValidityRows) {
        const reference = getTenderReference(tender);
        const dueAt = fromDateOnly(tender.price_bid_valid_upto);
        await saveSystemTask(
          this.buildSystemTaskPayload({
            title: `Price validity expiring: ${reference}`,
            description:
              "Review bid/price validity and initiate extension or decision before expiry.",
            systemRuleCode: "price_bid_validity_expiry",
            moduleKey: "tenders",
            entityType: "tender",
            entityId: tender.id,
            linkedReference: reference,
            linkedUrl: `/tenders/${tender.id}`,
            dueAt,
            reminderAt: dueAt ? addDays(dueAt, -30) : null,
            reminderFrequency: "every_5_days",
            priority: "critical",
            assignee: getSystemAssignee(tender),
          }),
        );
      }

      const technicalValidityRows = await Tender.findAll({
        where: {
          technical_bid_validity_applicable: true,
          technical_bid_valid_upto: { [Op.between]: [todayOnly, inThirtyDaysOnly] },
          status: { [Op.notIn]: ["cancelled", "closed"] },
        },
        transaction,
      });

      for (const tender of technicalValidityRows) {
        const reference = getTenderReference(tender);
        const dueAt = fromDateOnly(tender.technical_bid_valid_upto);
        await saveSystemTask(
          this.buildSystemTaskPayload({
            title: `Technical bid validity expiring: ${reference}`,
            description:
              "Review technical bid validity and initiate extension/approval action before expiry.",
            systemRuleCode: "technical_bid_validity_expiry",
            moduleKey: "tenders",
            entityType: "tender",
            entityId: tender.id,
            linkedReference: reference,
            linkedUrl: `/tenders/${tender.id}`,
            dueAt,
            reminderAt: dueAt ? addDays(dueAt, -30) : null,
            reminderFrequency: "every_5_days",
            priority: "critical",
            assignee: getSystemAssignee(tender),
          }),
        );
      }

      const emdExpiryRows = await TenderEmdEntry.findAll({
        where: {
          bg_valid_upto: { [Op.between]: [todayOnly, inThirtyDaysOnly] },
          emd_submission_status: { [Op.notIn]: ["not_submitted", "refunded"] },
        },
        include: [{ model: Tender, as: "tender" }],
        transaction,
      });

      for (const emd of emdExpiryRows) {
        const reference = getTenderReference(emd.tender || { id: emd.tender_id });
        const dueAt = fromDateOnly(emd.bg_valid_upto);
        await saveSystemTask(
          this.buildSystemTaskPayload({
            title: `EMD BG validity expiring: ${reference}`,
            description: "Check EMD BG validity/refund/retention action before expiry.",
            systemRuleCode: "emd_bg_expiry",
            moduleKey: "emd",
            entityType: "emd_entry",
            entityId: emd.id,
            linkedReference: reference,
            linkedUrl: emd.tender_id ? `/tenders/${emd.tender_id}` : null,
            dueAt,
            reminderAt: dueAt ? addDays(dueAt, -7) : null,
            priority: "high",
            severity: "urgent",
            assignee: getSystemAssignee(emd),
          }),
        );
      }

      const emdRefundRows = await TenderEmdEntry.findAll({
        where: {
          refund_status: "pending",
        },
        include: [{ model: Tender, as: "tender" }],
        transaction,
      });

      for (const emd of emdRefundRows) {
        const reference = getTenderReference(emd.tender || { id: emd.tender_id });
        const dueAt = fromDateOnly(emd.refund_date || todayOnly);
        await saveSystemTask(
          this.buildSystemTaskPayload({
            title: `EMD refund pending: ${reference}`,
            description: "Complete EMD refund approval/receiving documentation and update refund status.",
            systemRuleCode: "emd_refund_pending",
            moduleKey: "emd",
            entityType: "emd_entry",
            entityId: emd.id,
            linkedReference: reference,
            linkedUrl: emd.tender_id ? `/tenders/${emd.tender_id}` : null,
            dueAt,
            reminderAt: dueAt,
            priority: "high",
            severity: "urgent",
            assignee: getSystemAssignee(emd),
          }),
        );
      }

      const pbgExpiryRows = await PbgEntry.findAll({
        where: {
          valid_upto: { [Op.between]: [todayOnly, inThirtyDaysOnly] },
          status: "active",
        },
        include: [{ model: Tender, as: "tender" }],
        transaction,
      });

      for (const pbg of pbgExpiryRows) {
        const reference = getTenderReference(pbg.tender || { id: pbg.tender_id });
        const dueAt = fromDateOnly(pbg.valid_upto);
        await saveSystemTask(
          this.buildSystemTaskPayload({
            title: `PBG expiring soon: ${reference}`,
            description: "Check renewal, extension, release, or short-validity action for this PBG.",
            systemRuleCode: "pbg_expiry_warning",
            moduleKey: "pbg",
            entityType: "pbg_entry",
            entityId: pbg.id,
            linkedReference: reference,
            linkedUrl: pbg.tender_id ? `/tenders/${pbg.tender_id}` : null,
            dueAt,
            reminderAt: dueAt ? addDays(dueAt, -7) : null,
            priority: "critical",
            severity: "critical",
            assignee: getSystemAssignee(pbg),
          }),
        );
      }

      const committeeRows = await CommitteeMeeting.findAll({
        where: {
          meeting_date: { [Op.between]: [todayOnly, inSevenDaysOnly] },
          status: { [Op.notIn]: ["cancelled", "completed"] },
        },
        transaction,
      });

      for (const meeting of committeeRows) {
        const dueAt = fromCommitteeMeetingDateTime(meeting);
        if (!dueAt || dueAt <= now) continue;
        const dayBeforeReminderAt = addDays(dueAt, -1);
        await saveSystemTask(
          this.buildSystemTaskPayload({
            title: `Committee meeting scheduled: ${meeting.meeting_no}`,
            description: "Review agenda, attendance, and proceedings upload requirements.",
            systemRuleCode: "committee_meeting_scheduled",
            moduleKey: "committee",
            entityType: "committee_meeting",
            entityId: meeting.id,
            linkedReference: meeting.meeting_no,
            linkedUrl: `/committees/${meeting.id}`,
            dueAt,
            reminderAt: dayBeforeReminderAt > now ? dayBeforeReminderAt : dueAt,
            priority: "high",
            severity: "urgent",
            assignee: getSystemAssignee(meeting),
          }),
        );
      }

      const approvalSteps = await ApprovalRequestStep.findAll({
        where: {
          status: "pending",
          approver_employee_id: { [Op.ne]: null },
        },
        include: [
          {
            model: ApprovalRequest,
            as: "approval_request",
            where: { status: "pending" },
          },
        ],
        transaction,
      });

      for (const step of approvalSteps) {
        const request = step.approval_request;
        await saveSystemTask(
          this.buildSystemTaskPayload({
            title: `Approval pending: ${request.request_title}`,
            description: request.request_reason || "Approval request is pending with the assigned approver.",
            systemRuleCode: "approval_pending",
            moduleKey: request.module_key || "approval",
            entityType: "approval_request",
            entityId: request.id,
            linkedReference: request.request_title,
            linkedUrl: "/approvals",
            dueAt: addDays(new Date(request.applied_at || new Date()), 2),
            reminderAt: addDays(new Date(), 1),
            priority: "high",
            severity: "urgent",
            assignee: {
              assigned_to_employee_id: step.approver_employee_id,
              assigned_to_name: step.level_name,
            },
          }),
        );
      }

      return result;
    });
  }
}

module.exports = WorkTaskService;
