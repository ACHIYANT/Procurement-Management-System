let reminderTasks = [];
let remindersEnabled = false;

const getReminderFrequencyMs = (frequency) => {
  if (frequency === "every_15_minutes") return 15 * 60 * 1000;
  if (frequency === "hourly") return 60 * 60 * 1000;
  if (frequency === "every_2_hours") return 2 * 60 * 60 * 1000;
  if (frequency === "every_6_hours") return 6 * 60 * 60 * 1000;
  if (frequency === "every_12_hours") return 12 * 60 * 60 * 1000;
  if (frequency === "every_5_days") return 5 * 24 * 60 * 60 * 1000;
  if (frequency === "daily") return 24 * 60 * 60 * 1000;
  if (frequency === "weekly") return 7 * 24 * 60 * 60 * 1000;
  return null;
};

const getReminderNotificationKey = (task, nowMs) => {
  if (!task?.reminder_at) return null;
  const reminderAt = new Date(task.reminder_at).getTime();
  if (Number.isNaN(reminderAt) || reminderAt > nowMs) return null;

  const frequency = task.reminder_frequency || "once";
  const intervalMs = getReminderFrequencyMs(frequency);
  if (!intervalMs) return `pms_work_reminder_${task.id}_${task.reminder_at}_once`;

  const slot = Math.floor((nowMs - reminderAt) / intervalMs);
  return `pms_work_reminder_${task.id}_${task.reminder_at}_${frequency}_${slot}`;
};

const findDueTasks = () => {
  if (!remindersEnabled) return [];
  const now = Date.now();
  return reminderTasks
    .filter((task) => task?.reminder_at && !["completed", "cancelled"].includes(task.status))
    .filter((task) => Boolean(getReminderNotificationKey(task, now)));
};

const tick = () => {
  const dueTasks = findDueTasks();
  if (!dueTasks.length) return;
  self.postMessage({ type: "due-reminders", tasks: dueTasks });
};

self.addEventListener("message", (event) => {
  const message = event.data || {};
  if (message.type === "sync-reminders") {
    reminderTasks = Array.isArray(message.tasks) ? message.tasks : [];
    remindersEnabled = Boolean(message.enabled);
    tick();
  }

  if (message.type === "set-enabled") {
    remindersEnabled = Boolean(message.enabled);
    tick();
  }
});

self.setInterval(tick, 15 * 1000);
