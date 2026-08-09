import { procurementRequest, postProcurement } from "@/lib/procurement-api";

const REMINDER_ENABLED_KEY = "pms_work_reminders_enabled";
export const WORK_REMINDER_REFRESH_EVENT = "pms-work-reminders-refresh";
export const WORK_REMINDER_DELIVERED_EVENT = "pms-work-reminder-delivered";

const pad = (value) => String(value).padStart(2, "0");

const formatReminderDateTime = (value) => {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const areWorkRemindersEnabled = () => {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  try {
    return (
      localStorage.getItem(REMINDER_ENABLED_KEY) === "true" &&
      Notification.permission === "granted"
    );
  } catch {
    return false;
  }
};

export const setWorkReminderStorage = (enabled) => {
  try {
    if (enabled) {
      localStorage.setItem(REMINDER_ENABLED_KEY, "true");
    } else {
      localStorage.removeItem(REMINDER_ENABLED_KEY);
    }
    window.dispatchEvent(
      new CustomEvent("pms-work-reminder-setting-changed", {
        detail: { enabled },
      }),
    );
  } catch {
    // Storage can be unavailable in restricted browser modes; UI state still controls this session.
  }
};

export const requestGlobalWorkReminderRefresh = () => {
  try {
    window.dispatchEvent(new CustomEvent(WORK_REMINDER_REFRESH_EVENT));
  } catch {
    // A refresh request is only a convenience signal for the global reminder monitor.
  }
};

const emitWorkReminderDelivered = (task) => {
  try {
    window.dispatchEvent(
      new CustomEvent(WORK_REMINDER_DELIVERED_EVENT, {
        detail: {
          id: task.id,
          title: task.title || "Work reminder",
          description: task.description || "",
          due_at: task.due_at || null,
          reminder_at: task.reminder_at || null,
          priority: task.priority || "medium",
          severity: task.severity || "normal",
          linked_reference: task.linked_reference || "",
          linked_url: task.linked_url || "/my-work",
        },
      }),
    );
  } catch {
    // The browser notification remains the source of truth if the in-app card cannot be emitted.
  }
};

const playToneSequence = (context, notes) => {
  notes.forEach(({ frequency, start, duration, gain = 0.34, type = "triangle" }) => {
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    volume.gain.setValueAtTime(0.001, context.currentTime + start);
    volume.gain.exponentialRampToValueAtTime(gain, context.currentTime + start + 0.025);
    volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + start + duration);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start(context.currentTime + start);
    oscillator.stop(context.currentTime + start + duration + 0.03);
  });
};

const speakReminderTitle = (message) => {
  if (!message || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(`Reminder. ${message}`);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
};

export const playReminderSound = (sound = "soft_bell", message = "") => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    if (sound === "voice_alert") speakReminderTitle(message);
    return;
  }
  const context = new AudioContext();
  const soundPatterns = {
    chime: [
      { frequency: 523, start: 0, duration: 0.18, gain: 0.28 },
      { frequency: 784, start: 0.18, duration: 0.22, gain: 0.34 },
      { frequency: 1047, start: 0.42, duration: 0.42, gain: 0.26 },
    ],
    double_ping: [
      { frequency: 1047, start: 0, duration: 0.12, gain: 0.4, type: "sine" },
      { frequency: 1047, start: 0.22, duration: 0.14, gain: 0.42, type: "sine" },
    ],
    digital_alarm: [
      { frequency: 880, start: 0, duration: 0.16, gain: 0.44, type: "square" },
      { frequency: 660, start: 0.2, duration: 0.16, gain: 0.42, type: "square" },
      { frequency: 880, start: 0.4, duration: 0.16, gain: 0.44, type: "square" },
      { frequency: 660, start: 0.6, duration: 0.2, gain: 0.42, type: "square" },
    ],
    soft_bell: [
      { frequency: 659, start: 0, duration: 0.2, gain: 0.3 },
      { frequency: 880, start: 0.22, duration: 0.24, gain: 0.36 },
      { frequency: 1175, start: 0.5, duration: 0.34, gain: 0.32 },
    ],
    urgent_alert: [
      { frequency: 740, start: 0, duration: 0.22, gain: 0.42, type: "square" },
      { frequency: 988, start: 0.26, duration: 0.24, gain: 0.46, type: "square" },
      { frequency: 740, start: 0.56, duration: 0.28, gain: 0.42, type: "square" },
    ],
  };
  const notes =
    sound === "voice_alert"
      ? soundPatterns.urgent_alert
      : soundPatterns[sound] || soundPatterns.soft_bell;

  playToneSequence(context, notes);
  window.setTimeout(() => context.close().catch(() => {}), 1400);

  if (sound === "voice_alert") {
    window.setTimeout(() => speakReminderTitle(message), 900);
  }
};

export const getReminderFrequencyMs = (frequency) => {
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

export const getReminderNotificationKey = (task, nowMs) => {
  if (!task?.reminder_at) return null;
  const reminderDate = new Date(task.reminder_at);
  const reminderAt = reminderDate.getTime();
  if (Number.isNaN(reminderAt) || reminderAt > nowMs) return null;
  const reminderKeyAt = reminderDate.toISOString();

  const frequency = task.reminder_frequency || "once";
  const intervalMs = getReminderFrequencyMs(frequency);
  if (!intervalMs) {
    return `pms_work_reminder_${task.id}_${reminderKeyAt}_once`;
  }

  const slot = Math.floor((nowMs - reminderAt) / intervalMs);
  return `pms_work_reminder_${task.id}_${reminderKeyAt}_${frequency}_${slot}`;
};

export const wasReminderAlreadyShown = (storageKey) => {
  try {
    return Boolean(localStorage.getItem(storageKey));
  } catch {
    return false;
  }
};

export const markReminderShown = (storageKey) => {
  try {
    localStorage.setItem(storageKey, "shown");
  } catch {
    // Failing to persist duplicate suppression should not break reminders.
  }
};

const acknowledgeWorkPushDelivery = async ({ employeeId, notificationKey, taskId }) => {
  if (!employeeId || !notificationKey || !taskId || String(taskId) === "permission-test") {
    return false;
  }
  try {
    await postProcurement("/work-push/acknowledge", {
      employee_id: employeeId,
      task_id: taskId,
      notification_key: notificationKey,
    });
    return true;
  } catch {
    // Best-effort duplicate suppression; local duplicate protection still applies.
    return false;
  }
};

const waitForServiceWorkerReady = () =>
  Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => {
      window.setTimeout(() => resolve(null), 1200);
    }),
  ]);

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
};

export const ensureWorkPushSubscription = async ({ employeeId }) => {
  if (!employeeId || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { enabled: false, reason: "unsupported" };
  }

  const keyConfig = await procurementRequest("/work-push/public-key");
  if (!keyConfig?.enabled || !keyConfig.publicKey) {
    return { enabled: false, reason: "server_not_configured" };
  }

  const registration = await waitForServiceWorkerReady();
  if (!registration?.pushManager) {
    return { enabled: false, reason: "service_worker_not_ready" };
  }

  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription =
    existingSubscription ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyConfig.publicKey),
    }));

  await postProcurement("/work-push/subscribe", {
    employee_id: employeeId,
    subscription: subscription.toJSON(),
    user_agent: window.navigator.userAgent,
  });

  return { enabled: true };
};

export const showWorkReminderNotification = async (task) => {
  const title = task.title || "Work reminder";
  const body = `Due ${formatReminderDateTime(task.due_at)}. ${
    task.linked_reference || "Open My Work for details."
  }`;
  const data = {
    taskId: task.id,
    url: task.linked_url || "/my-work",
  };
  const options = {
    body,
    tag: `pms-work-task-${task.id}`,
    renotify: true,
    requireInteraction: task.priority === "critical" || task.severity === "critical",
    silent: task.reminder_sound === "silent",
    timestamp: Date.now(),
    data,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
  };

  if (!options.silent) {
    options.vibrate = [180, 90, 180];
  }

  let serviceWorkerError = null;
  if ("serviceWorker" in navigator) {
    try {
      const registration = await waitForServiceWorkerReady();
      if (registration?.showNotification) {
        await registration.showNotification(title, options);
        return;
      }
    } catch (error) {
      serviceWorkerError = error;
    }
  }

  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, options);
    return;
  }

  if (serviceWorkerError) throw serviceWorkerError;
  throw new Error("Notification permission is not granted.");
};

export const runDueWorkReminderNotifications = async (tasks = [], options = {}) => {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (!areWorkRemindersEnabled()) return;

  const now = Date.now();
  const employeeId = options.employeeId || null;
  for (const task of tasks) {
    if (!task?.reminder_at || ["completed", "cancelled"].includes(task.status)) continue;
    const storageKey = getReminderNotificationKey(task, now);
    if (!storageKey || wasReminderAlreadyShown(storageKey)) continue;
    markReminderShown(storageKey);
    await acknowledgeWorkPushDelivery({
      employeeId,
      notificationKey: storageKey,
      taskId: task.id,
    });

    try {
      await showWorkReminderNotification(task);
    } catch {
      // Native notification cards can be blocked by OS/browser settings. Keep PMS reminders alive.
    }

    emitWorkReminderDelivered(task);
    if (task.reminder_sound !== "silent") {
      try {
        playReminderSound(task.reminder_sound, task.title);
      } catch {
        // Browsers can block audio in background tabs; keep notification reminders enabled.
      }
    }
  }
};

export const getLocalDateTimeValue = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
