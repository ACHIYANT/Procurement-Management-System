"use strict";

const WorkTaskService = require("./work-task-service");
const WorkPushService = require("./work-push-service");

const DEFAULT_INTERVAL_MINUTES = 1;

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

  const run = async () => {
    try {
      const [syncResult, reminderResult, escalationResult, pushResult] = await Promise.all([
        service.syncSystemTasks(),
        service.syncReminderOccurrences(),
        service.escalateOverdueTasks(),
        pushService.sendDueReminderPushes(),
      ]);
      console.log(
        `[WorkTaskScheduler] synced ${syncResult.created} created/${syncResult.updated} updated; refreshed ${reminderResult.scanned} reminder sources; escalated ${escalationResult.escalated}; push sent ${pushResult.sent}/${pushResult.scanned} due reminders.`,
      );
    } catch (error) {
      console.error("[WorkTaskScheduler] run failed:", error.message || error);
    }
  };

  run();
  const interval = setInterval(run, intervalMs);

  if (typeof interval.unref === "function") interval.unref();

  return interval;
};

module.exports = {
  startWorkTaskScheduler,
};
