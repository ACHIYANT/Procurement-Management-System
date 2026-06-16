"use strict";

const WorkTaskService = require("./work-task-service");

const DEFAULT_INTERVAL_MINUTES = 15;

const startWorkTaskScheduler = () => {
  if (String(process.env.WORK_TASK_SCHEDULER_DISABLED || "").toLowerCase() === "true") {
    return null;
  }

  const service = new WorkTaskService();
  const intervalMinutes = Number(
    process.env.WORK_TASK_SCHEDULER_INTERVAL_MINUTES || DEFAULT_INTERVAL_MINUTES,
  );
  const intervalMs = Math.max(intervalMinutes, 1) * 60 * 1000;

  const run = async () => {
    try {
      const [syncResult, escalationResult] = await Promise.all([
        service.syncSystemTasks(),
        service.escalateOverdueTasks(),
      ]);
      console.log(
        `[WorkTaskScheduler] synced ${syncResult.created} created/${syncResult.updated} updated; escalated ${escalationResult.escalated}.`,
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
