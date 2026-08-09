"use strict";

const crypto = require("crypto");
const webPush = require("web-push");
const { Op } = require("sequelize");
const {
  WorkPushNotificationLog,
  WorkPushSubscription,
  sequelize,
} = require("../../models");
const { WorkTaskRepository } = require("../repository/work-task-repository");
const { asId, normalizeNullableText } = require("../utils/procurement-domain");

const ACTIVE_TASK_STATUSES = new Set(["open", "in_progress", "returned", "reassigned"]);
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

const getVapidConfig = () => ({
  publicKey: normalizeNullableText(process.env.WORK_PUSH_VAPID_PUBLIC_KEY),
  privateKey: normalizeNullableText(process.env.WORK_PUSH_VAPID_PRIVATE_KEY),
  subject:
    normalizeNullableText(process.env.WORK_PUSH_VAPID_SUBJECT) ||
    normalizeNullableText(process.env.CLIENT_URL) ||
    "mailto:admin@example.com",
});

const isPushConfigured = () => {
  const config = getVapidConfig();
  return Boolean(config.publicKey && config.privateKey);
};

const configureWebPush = () => {
  const config = getVapidConfig();
  if (!config.publicKey || !config.privateKey) return false;
  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return true;
};

const hashEndpoint = (endpoint) =>
  crypto.createHash("sha256").update(String(endpoint || "")).digest("hex");

const parseSubscription = (value) => {
  if (!value || typeof value !== "object") {
    const error = new Error("Push subscription is required.");
    error.statusCode = 400;
    throw error;
  }

  const endpoint = normalizeNullableText(value.endpoint);
  const p256dh = normalizeNullableText(value.keys?.p256dh);
  const auth = normalizeNullableText(value.keys?.auth);
  if (!endpoint || !p256dh || !auth) {
    const error = new Error("Push subscription endpoint and keys are required.");
    error.statusCode = 400;
    throw error;
  }

  return { endpoint, p256dh, auth, raw: value };
};

const getReminderNotificationKey = (task, nowMs = Date.now()) => {
  if (!task?.reminder_at) return null;
  const reminderAt = new Date(task.reminder_at).getTime();
  if (Number.isNaN(reminderAt) || reminderAt > nowMs) return null;

  const frequency = task.reminder_frequency || "once";
  const intervalMs = REMINDER_FREQUENCY_INTERVAL_MS[frequency];
  if (!intervalMs) return `pms_work_reminder_${task.id}_${task.reminder_at}_once`;

  const slot = Math.floor((nowMs - reminderAt) / intervalMs);
  return `pms_work_reminder_${task.id}_${task.reminder_at}_${frequency}_${slot}`;
};

const getReminderAssigneeIds = (task = {}) => {
  const ids = new Set();
  (task.assignees || []).forEach((assignee) => {
    if (assignee.assigned_to_employee_id) ids.add(Number(assignee.assigned_to_employee_id));
  });

  if (!ids.size && task.created_by_employee_id) ids.add(Number(task.created_by_employee_id));
  return Array.from(ids).filter(Boolean);
};

const buildPushPayload = (task, notificationKey) =>
  JSON.stringify({
    title: task.title || "Work reminder",
    description: task.description || "",
    body: `Due reminder${task.due_at ? ` for ${new Date(task.due_at).toLocaleString("en-IN")}` : ""}.`,
    url: task.linked_url || "/my-work",
    taskId: task.id,
    notificationKey,
    dueAt: task.due_at || null,
    reminderAt: task.reminder_at || null,
    priority: task.priority || "medium",
    severity: task.severity || "normal",
    reminderSound: task.reminder_sound || "soft_bell",
    linkedReference: task.linked_reference || null,
  });

class WorkPushService {
  constructor() {
    this.taskRepository = new WorkTaskRepository();
  }

  getPublicKey() {
    const { publicKey } = getVapidConfig();
    return {
      enabled: isPushConfigured(),
      publicKey: publicKey || null,
    };
  }

  async saveSubscription(payload = {}) {
    const employeeId = asId(payload.employee_id || payload.procurement_employee_id, "Employee id");
    const parsed = parseSubscription(payload.subscription);
    const endpointHash = hashEndpoint(parsed.endpoint);

    const row = {
      procurement_employee_id: employeeId,
      endpoint_hash: endpointHash,
      endpoint: parsed.endpoint,
      p256dh: parsed.p256dh,
      auth: parsed.auth,
      subscription_json: JSON.stringify(parsed.raw),
      user_agent: normalizeNullableText(payload.user_agent),
      is_active: true,
      last_seen_at: new Date(),
      last_error: null,
    };

    const existing = await WorkPushSubscription.findOne({ where: { endpoint_hash: endpointHash } });
    if (existing) {
      await existing.update(row);
      return existing;
    }

    return WorkPushSubscription.create(row);
  }

  async removeSubscription(payload = {}) {
    const parsed = parseSubscription(payload.subscription);
    const endpointHash = hashEndpoint(parsed.endpoint);
    const [updated] = await WorkPushSubscription.update(
      { is_active: false, last_seen_at: new Date() },
      { where: { endpoint_hash: endpointHash } },
    );
    return { removed: updated };
  }

  async acknowledgeReminderDelivery(payload = {}) {
    const employeeId = asId(payload.employee_id || payload.procurement_employee_id, "Employee id");
    const taskId = asId(payload.work_task_id || payload.task_id, "Task id");
    const notificationKey = normalizeNullableText(payload.notification_key);
    if (!notificationKey) {
      const error = new Error("Notification key is required.");
      error.statusCode = 400;
      throw error;
    }

    const subscriptions = await WorkPushSubscription.findAll({
      where: {
        procurement_employee_id: employeeId,
        is_active: true,
      },
    });

    let acknowledged = 0;
    for (const subscription of subscriptions) {
      const [log, created] = await WorkPushNotificationLog.findOrCreate({
        where: {
          work_push_subscription_id: subscription.id,
          notification_key: notificationKey,
        },
        defaults: {
          work_push_subscription_id: subscription.id,
          work_task_id: taskId,
          notification_key: notificationKey,
          sent_at: new Date(),
        },
      });

      if (!created && Number(log.work_task_id) !== taskId) {
        await log.update({
          work_task_id: taskId,
          sent_at: new Date(),
        });
      }
      acknowledged += 1;
    }

    return { acknowledged };
  }

  async sendDueReminderPushes() {
    const result = { configured: isPushConfigured(), scanned: 0, sent: 0, skipped: 0, failed: 0 };
    if (!configureWebPush()) return result;

    const tasks = await this.taskRepository.findActiveReminderSourceTasks();
    const now = Date.now();

    for (const task of tasks) {
      if (!ACTIVE_TASK_STATUSES.has(task.status)) continue;
      const notificationKey = getReminderNotificationKey(task, now);
      if (!notificationKey) continue;
      result.scanned += 1;

      const assigneeIds = getReminderAssigneeIds(task);
      if (!assigneeIds.length) {
        result.skipped += 1;
        continue;
      }

      const subscriptions = await WorkPushSubscription.findAll({
        where: {
          procurement_employee_id: { [Op.in]: assigneeIds },
          is_active: true,
        },
      });

      for (const subscription of subscriptions) {
        const alreadySent = await WorkPushNotificationLog.findOne({
          where: {
            work_push_subscription_id: subscription.id,
            notification_key: notificationKey,
          },
        });
        if (alreadySent) {
          result.skipped += 1;
          continue;
        }

        try {
          await webPush.sendNotification(
            JSON.parse(subscription.subscription_json),
            buildPushPayload(task, notificationKey),
          );
          await WorkPushNotificationLog.create({
            work_push_subscription_id: subscription.id,
            work_task_id: task.id,
            notification_key: notificationKey,
            sent_at: new Date(),
          });
          result.sent += 1;
        } catch (error) {
          result.failed += 1;
          const statusCode = Number(error?.statusCode || error?.status || 0);
          await subscription.update({
            is_active: statusCode === 404 || statusCode === 410 ? false : subscription.is_active,
            last_error: error?.message || "Unable to send push notification.",
          });
        }
      }
    }

    await sequelize.transaction(async (transaction) => {
      await WorkPushNotificationLog.destroy({
        where: {
          sent_at: { [Op.lt]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        transaction,
      });
    });

    return result;
  }
}

module.exports = WorkPushService;
