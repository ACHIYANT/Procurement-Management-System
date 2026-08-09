import { useEffect, useRef, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { BellRing, Lightbulb, LightbulbOff, LogOut, X } from "lucide-react";

import PmsSidebar from "@/components/PmsSidebar";
import { toAuthApiUrl, toProcurementApiUrl } from "@/lib/api-config";
import { procurementRequest } from "@/lib/procurement-api";
import { getCurrentUserProfile } from "@/lib/roles";
import {
  WORK_REMINDER_DELIVERED_EVENT,
  WORK_REMINDER_REFRESH_EVENT,
  areWorkRemindersEnabled,
  ensureWorkPushSubscription,
  runDueWorkReminderNotifications,
} from "@/lib/work-reminder-notifications";
import govtLogo from "/govt.svg";
import hartronLogo from "/logo.svg";

const DARK_MODE_STORAGE_KEY = "pms_dark_mode_enabled";

function ThemeGlowToggle() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(DARK_MODE_STORAGE_KEY) === "true";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("pms-dark", darkMode);
    localStorage.setItem(DARK_MODE_STORAGE_KEY, String(darkMode));
  }, [darkMode]);

  const Icon = darkMode ? Lightbulb : LightbulbOff;

  return (
    <button
      type="button"
      aria-pressed={darkMode}
      aria-label={darkMode ? "Disable dark mode" : "Enable dark mode"}
      title={darkMode ? "Disable dark mode" : "Enable dark mode"}
      onClick={() => setDarkMode((current) => !current)}
      className={`inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border text-sm font-semibold shadow-[0_16px_36px_-28px_rgba(0,0,0,0.8)] backdrop-blur-xl transition hover:-translate-y-0.5 ${
        darkMode
          ? "border-amber-200/30 bg-amber-300/16 text-amber-100 ring-1 ring-amber-200/20"
          : "border-black/8 bg-white/82 text-[#1d1d1f] ring-1 ring-white/70 hover:bg-white"
      }`}
    >
      <span
        className={`grid h-7 w-7 place-items-center rounded-full transition ${
          darkMode
            ? "bg-amber-300 text-black shadow-[0_0_28px_rgba(251,191,36,0.85)]"
            : "bg-[#f5f5f7] text-black/54 ring-1 ring-black/8"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
    </button>
  );
}

function PmsBrandHeader() {
  const [userName, setUserName] = useState("Login Name");

  useEffect(() => {
    const storedUser = localStorage.getItem("fullname");
    if (storedUser) {
      setUserName(storedUser);
    }
  }, []);

  const handleLogout = () => {
    fetch(toAuthApiUrl("/signout"), {
      method: "POST",
      credentials: "include",
    })
      .catch(() => {
        // Ignore sign-out network failures; local cleanup still runs.
      })
      .finally(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("fullname");
        localStorage.removeItem("roles");
        localStorage.removeItem("me");
        window.location.href = "/login";
      });
  };

  return (
    <header className="pms-brand-header no-print shrink-0 border-b border-slate-200/70 backdrop-blur-xl print:hidden">
      <div className="mx-auto flex w-full max-w-600 flex-wrap items-center gap-2 px-2 py-2 sm:px-4 sm:py-3 lg:px-6 min-[1920px]:px-10 min-[2560px]:px-14">
        <Link
          to="/dashboard"
          className="pms-brand-identity flex min-w-0 flex-1 items-center gap-2 sm:gap-3"
          aria-label="Go to PMS dashboard"
        >
          <span className="pms-brand-mark pms-brand-mark-hartron">
            <img
              src={hartronLogo}
              alt="HARTRON Logo"
              className="h-8 w-auto shrink-0 sm:h-10"
            />
          </span>
          <div className="pms-brand-divider h-7 border-l-2 border-slate-200 sm:h-8" />
          <span className="pms-brand-mark pms-brand-mark-govt">
            <span className="pms-govt-emblem-frame">
              <img
                src={govtLogo}
                alt="Government Logo"
                className="pms-govt-logo h-8 w-auto shrink-0 sm:h-10"
              />
            </span>
            <span className="pms-govt-wordmark" aria-hidden="true">
              <span>Haryana State Electronics</span>
              <span>Development Corporation Limited</span>
              <span>(A State Government Undertaking)</span>
            </span>
          </span>
        </Link>

        <div className="ml-auto flex flex-none items-center gap-2">
          <ThemeGlowToggle />
          <div className="pms-brand-user-menu flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white/80 px-2 py-1.5 sm:px-3">
            <span className="pms-brand-user-name hidden max-w-[38vw] truncate text-xs text-slate-600 sm:inline sm:text-sm">
              {userName}
            </span>
            <button
              type="button"
              className="pms-brand-signout inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 sm:text-sm"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

const getCurrentProcurementEmployeeId = () => {
  const profile = getCurrentUserProfile();
  return profile?.employee_id || profile?.procurement_employee_id || null;
};

const formatFlashDateTime = (value) => {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function WorkReminderFlashCard({ reminder, onClose }) {
  useEffect(() => {
    if (!reminder) return undefined;
    const timeout = window.setTimeout(onClose, 18000);
    return () => window.clearTimeout(timeout);
  }, [onClose, reminder]);

  if (!reminder) return null;

  const isCritical = reminder.priority === "critical" || reminder.severity === "critical";

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[100] w-[min(380px,calc(100vw-2rem))] print:hidden">
      <div
        className={`pointer-events-auto overflow-hidden rounded-[28px] border bg-white/94 shadow-[0_28px_80px_-38px_rgba(15,23,42,0.65)] ring-1 ring-white/70 backdrop-blur-2xl pms-dark:bg-[#16171c]/94 pms-dark:ring-white/10 ${
          isCritical
            ? "border-rose-200 pms-dark:border-rose-400/35"
            : "border-sky-200 pms-dark:border-sky-400/35"
        }`}
      >
        <div
          className={`h-1.5 ${
            isCritical
              ? "bg-[linear-gradient(90deg,#ef4444,#fb7185,#f59e0b)]"
              : "bg-[linear-gradient(90deg,#2563eb,#38bdf8,#22c55e)]"
          }`}
        />
        <div className="flex gap-3 p-4">
          <span
            className={`grid h-11 w-11 flex-none place-items-center rounded-2xl ${
              isCritical
                ? "bg-rose-50 text-rose-600 ring-1 ring-rose-100 pms-dark:bg-rose-500/14 pms-dark:text-rose-200 pms-dark:ring-rose-300/20"
                : "bg-sky-50 text-sky-600 ring-1 ring-sky-100 pms-dark:bg-sky-500/14 pms-dark:text-sky-200 pms-dark:ring-sky-300/20"
            }`}
          >
            <BellRing className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-slate-400 pms-dark:text-slate-500">
              Work Reminder
            </p>
            <h3 className="mt-1 line-clamp-2 text-base font-bold text-slate-950 pms-dark:text-white">
              {reminder.title}
            </h3>
            <p className="mt-1 text-sm text-slate-600 pms-dark:text-slate-300">
              {formatFlashDateTime(reminder.due_at || reminder.reminder_at)}
              {reminder.linked_reference ? ` • ${reminder.linked_reference}` : ""}
            </p>
            {reminder.description ? (
              <p className="mt-2 line-clamp-2 text-sm text-slate-500 pms-dark:text-slate-400">
                {reminder.description}
              </p>
            ) : null}
            <div className="mt-4 flex items-center gap-2">
              <Link
                to={reminder.linked_url || "/my-work"}
                onClick={onClose}
                className="inline-flex items-center rounded-full bg-[#1473e6] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_-18px_rgba(20,115,230,0.9)] hover:bg-[#0f66d0]"
              >
                Open
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 pms-dark:border-white/10 pms-dark:bg-white/6 pms-dark:text-slate-200 pms-dark:hover:bg-white/10"
              >
                Dismiss
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss reminder"
            onClick={onClose}
            className="grid h-8 w-8 flex-none place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 pms-dark:hover:bg-white/10 pms-dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function GlobalWorkReminderMonitor({ onReminderDelivered }) {
  const workerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let pushRegistrationInFlight = false;
    let pushRegistrationDone = false;
    let worker = null;

    const buildReminderApiUrl = () => {
      const employeeId = getCurrentProcurementEmployeeId();
      if (!employeeId) return null;
      const params = new URLSearchParams({
        status: "active",
        limit: "500",
        employee_id: employeeId,
      });
      return toProcurementApiUrl(`/work-tasks?${params.toString()}`);
    };

    const configureWorker = () => {
      const apiUrl = buildReminderApiUrl();
      worker?.postMessage({
        type: "configure",
        enabled: areWorkRemindersEnabled() && Boolean(apiUrl),
        apiUrl,
      });
    };

    const ensurePushRegistration = async () => {
      if (
        cancelled ||
        pushRegistrationDone ||
        pushRegistrationInFlight ||
        !areWorkRemindersEnabled()
      ) {
        return;
      }

      const employeeId = getCurrentProcurementEmployeeId();
      if (!employeeId) return;

      pushRegistrationInFlight = true;
      try {
        const result = await ensureWorkPushSubscription({ employeeId });
        pushRegistrationDone = Boolean(result?.enabled);
      } catch {
        pushRegistrationDone = false;
      } finally {
        pushRegistrationInFlight = false;
      }
    };

    if ("Worker" in window) {
      worker = new Worker("/pms-work-reminder-worker.js");
      workerRef.current = worker;
      worker.addEventListener("message", (event) => {
        const message = event.data || {};
        if (message.type === "due-reminders") {
          runDueWorkReminderNotifications(Array.isArray(message.tasks) ? message.tasks : [], {
            employeeId: getCurrentProcurementEmployeeId(),
          });
        }
      });
      configureWorker();
    }

    const pollReminders = async () => {
      if (cancelled || inFlight || !areWorkRemindersEnabled()) return;
      const employeeId = getCurrentProcurementEmployeeId();
      if (!employeeId) return;

      inFlight = true;
      try {
        await ensurePushRegistration();
        const params = new URLSearchParams({
          status: "active",
          limit: "500",
          employee_id: employeeId,
        });
        const tasks = await procurementRequest(`/work-tasks?${params.toString()}`);
        if (!cancelled) {
          const taskRows = Array.isArray(tasks) ? tasks : [];
          worker?.postMessage({
            type: "sync-reminders",
            enabled: areWorkRemindersEnabled(),
            tasks: taskRows,
          });
          await runDueWorkReminderNotifications(taskRows, {
            employeeId,
          });
        }
      } catch {
        // Reminder polling must never interrupt the active page workflow.
      } finally {
        inFlight = false;
      }
    };

    const handleVisibilityOrSettingChange = () => {
      configureWorker();
      ensurePushRegistration();
      pollReminders();
    };

    const handleReminderDelivered = (event) => {
      if (event.detail) onReminderDelivered(event.detail);
    };

    const handleServiceWorkerMessage = (event) => {
      const message = event.data || {};
      if (message.type !== "work-reminder-push" || !message.task) return;
      const notificationKey = message.task.notification_key || null;
      let alreadyDelivered = false;
      if (notificationKey) {
        try {
          alreadyDelivered = Boolean(localStorage.getItem(notificationKey));
          if (!alreadyDelivered) {
            localStorage.setItem(notificationKey, "shown");
          }
        } catch {
          // If storage is unavailable, still show the in-app card from the push event.
        }
      }

      try {
        event.ports?.[0]?.postMessage({ alreadyDelivered });
      } catch {
        // If the service worker cannot receive the claim, it will show the push notification.
      }

      if (!alreadyDelivered) {
        onReminderDelivered(message.task);
      }
    };

    ensurePushRegistration();
    pollReminders();
    const interval = window.setInterval(pollReminders, 60 * 1000);
    window.addEventListener("focus", handleVisibilityOrSettingChange);
    window.addEventListener("pms-work-reminder-setting-changed", handleVisibilityOrSettingChange);
    window.addEventListener(WORK_REMINDER_REFRESH_EVENT, handleVisibilityOrSettingChange);
    window.addEventListener(WORK_REMINDER_DELIVERED_EVENT, handleReminderDelivered);
    navigator.serviceWorker?.addEventListener("message", handleServiceWorkerMessage);
    document.addEventListener("visibilitychange", handleVisibilityOrSettingChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleVisibilityOrSettingChange);
      window.removeEventListener("pms-work-reminder-setting-changed", handleVisibilityOrSettingChange);
      window.removeEventListener(WORK_REMINDER_REFRESH_EVENT, handleVisibilityOrSettingChange);
      window.removeEventListener(WORK_REMINDER_DELIVERED_EVENT, handleReminderDelivered);
      navigator.serviceWorker?.removeEventListener("message", handleServiceWorkerMessage);
      document.removeEventListener("visibilitychange", handleVisibilityOrSettingChange);
      worker?.terminate();
      workerRef.current = null;
    };
  }, [onReminderDelivered]);

  return null;
}

export default function AppLayout() {
  const [reminderFlash, setReminderFlash] = useState(null);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#f5f5f7]">
      <GlobalWorkReminderMonitor onReminderDelivered={setReminderFlash} />
      <WorkReminderFlashCard reminder={reminderFlash} onClose={() => setReminderFlash(null)} />
      <PmsBrandHeader />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <PmsSidebar />
        <main className="pms-fancy-scrollbar h-full min-h-0 min-w-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f5f5f7_0%,#fbfbfd_100%)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
