let reminderTasks = [];
let remindersEnabled = false;
let reminderApiUrl = null;
let fetchInFlight = false;

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
  if (!intervalMs)
    return `pms_work_reminder_${task.id}_${task.reminder_at}_once`;

  const slot = Math.floor((nowMs - reminderAt) / intervalMs);
  return `pms_work_reminder_${task.id}_${task.reminder_at}_${frequency}_${slot}`;
};

const findDueTasks = () => {
  if (!remindersEnabled) return [];
  const now = Date.now();
  return reminderTasks
    .filter(
      (task) =>
        task?.reminder_at && !["completed", "cancelled"].includes(task.status),
    )
    .filter((task) => Boolean(getReminderNotificationKey(task, now)));
};

const tick = () => {
  const dueTasks = findDueTasks();
  if (!dueTasks.length) return;
  self.postMessage({ type: "due-reminders", tasks: dueTasks });
};

const fetchLatestReminders = async () => {
  if (!remindersEnabled || !reminderApiUrl || fetchInFlight) return;

  fetchInFlight = true;
  try {
    const response = await fetch(reminderApiUrl, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => ({}));
    if (
      response.ok &&
      payload?.success !== false &&
      Array.isArray(payload?.data)
    ) {
      reminderTasks = payload.data;
      tick();
    }
  } catch {
    // Background reminder refresh is best-effort; the page poll remains as fallback.
  } finally {
    fetchInFlight = false;
  }
};

self.addEventListener("message", (event) => {
  const message = event.data || {};
  if (message.type === "configure") {
    remindersEnabled = Boolean(message.enabled);
    reminderApiUrl = message.apiUrl || null;
    fetchLatestReminders();
    tick();
  }

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

self.setInterval(() => {
  fetchLatestReminders();
  tick();
}, 5 * 1000);
