"use strict";

const WorkTaskService = require("./work-task-service");
const WorkPushService = require("./work-push-service");

const DEFAULT_INTERVAL_MINUTES = 1;
const DEFAULT_RUN_SECOND_OFFSET = 10;

const emptySyncResult = { created: 0, updated: 0 };
const emptyReminderResult = { scanned: 0 };
const emptyEscalationResult = { escalated: 0 };
const emptyPushResult = { scanned: 0, sent: 0, skipped: 0, failed: 0 };

const runSchedulerJob = async (label, task, fallback) => {
  try {
    return await task();
  } catch (error) {
    console.error(`[WorkTaskScheduler] ${label} failed:`, error.message || error);
    return fallback;
  }
};

const getSchedulerRunOffsetMs = () => {
  const configured = Number(process.env.WORK_TASK_SCHEDULER_RUN_SECOND_OFFSET);
  const seconds = Number.isFinite(configured) ? configured : DEFAULT_RUN_SECOND_OFFSET;
  return Math.min(Math.max(seconds, 0), 59) * 1000;
};

const getDelayUntilNextAlignedRun = (intervalMs, offsetMs) => {
  const now = Date.now();
  const currentIntervalStart = Math.floor(now / intervalMs) * intervalMs;
  let nextRunAt = currentIntervalStart + offsetMs;
  if (nextRunAt <= now) nextRunAt += intervalMs;
  return Math.max(nextRunAt - now, 1000);
};

const startWorkTaskScheduler = () => {
  if (String(process.env.WORK_TASK_SCHEDULER_DISABLED || "").toLowerCase() === "true") {
    return null;
  }

  const service = new WorkTaskService();
  const pushService = new WorkPushService();
  const intervalMinutes = Number(
    process.env.WORK_TASK_SCHEDULER_INTERVAL_MINUTES || DEFAULT_INTERVAL_MINUTES,
  );
  const intervalMs = Math.max(intervalMinutes, 1) * 60 * 1000;
  const runOffsetMs = getSchedulerRunOffsetMs();

  const run = async () => {
    const [syncResult, reminderResult, escalationResult, pushResult] = await Promise.all([
      runSchedulerJob("system task sync", () => service.syncSystemTasks(), emptySyncResult),
      runSchedulerJob(
        "reminder occurrence refresh",
        () => service.syncReminderOccurrences(),
        emptyReminderResult,
      ),
      runSchedulerJob("overdue escalation", () => service.escalateOverdueTasks(), emptyEscalationResult),
      runSchedulerJob("web push delivery", () => pushService.sendDueReminderPushes(), emptyPushResult),
    ]);

    console.log(
      `[WorkTaskScheduler] synced ${syncResult.created} created/${syncResult.updated} updated; refreshed ${reminderResult.scanned} reminder sources; escalated ${escalationResult.escalated}; push sent ${pushResult.sent}/${pushResult.scanned} due reminders; skipped ${pushResult.skipped || 0}; failed ${pushResult.failed || 0}.`,
    );
  };

  run();
  let interval = null;
  const initialDelay = getDelayUntilNextAlignedRun(intervalMs, runOffsetMs);
  const initialTimeout = setTimeout(() => {
    run();
    interval = setInterval(run, intervalMs);
    if (typeof interval.unref === "function") interval.unref();
  }, initialDelay);

  if (typeof initialTimeout.unref === "function") initialTimeout.unref();

  return {
    stop() {
      clearTimeout(initialTimeout);
      if (interval) clearInterval(interval);
    },
  };
};

module.exports = {
  startWorkTaskScheduler,
};
