import { useEffect, useRef, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { Lightbulb, LightbulbOff, LogOut } from "lucide-react";

import PmsSidebar from "@/components/PmsSidebar";
import { toAuthApiUrl, toProcurementApiUrl } from "@/lib/api-config";
import { procurementRequest } from "@/lib/procurement-api";
import { getCurrentUserProfile } from "@/lib/roles";
import {
  WORK_REMINDER_REFRESH_EVENT,
  areWorkRemindersEnabled,
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
      <div className="mx-auto flex w-full max-w-[2400px] flex-wrap items-center gap-2 px-2 py-2 sm:px-4 sm:py-3 lg:px-6 min-[1920px]:px-10 min-[2560px]:px-14">
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

function GlobalWorkReminderMonitor() {
  const workerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
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

    if ("Worker" in window) {
      worker = new Worker("/pms-work-reminder-worker.js");
      workerRef.current = worker;
      worker.addEventListener("message", (event) => {
        const message = event.data || {};
        if (message.type === "due-reminders") {
          runDueWorkReminderNotifications(Array.isArray(message.tasks) ? message.tasks : []);
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
          await runDueWorkReminderNotifications(taskRows);
        }
      } catch {
        // Reminder polling must never interrupt the active page workflow.
      } finally {
        inFlight = false;
      }
    };

    const handleVisibilityOrSettingChange = () => {
      configureWorker();
      pollReminders();
    };

    pollReminders();
    const interval = window.setInterval(pollReminders, 60 * 1000);
    window.addEventListener("focus", handleVisibilityOrSettingChange);
    window.addEventListener("pms-work-reminder-setting-changed", handleVisibilityOrSettingChange);
    window.addEventListener(WORK_REMINDER_REFRESH_EVENT, handleVisibilityOrSettingChange);
    document.addEventListener("visibilitychange", handleVisibilityOrSettingChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleVisibilityOrSettingChange);
      window.removeEventListener("pms-work-reminder-setting-changed", handleVisibilityOrSettingChange);
      window.removeEventListener(WORK_REMINDER_REFRESH_EVENT, handleVisibilityOrSettingChange);
      document.removeEventListener("visibilitychange", handleVisibilityOrSettingChange);
      worker?.terminate();
      workerRef.current = null;
    };
  }, []);

  return null;
}

export default function AppLayout() {
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#f5f5f7]">
      <GlobalWorkReminderMonitor />
      <PmsBrandHeader />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <PmsSidebar />
        <main className="pms-fancy-scrollbar h-full min-h-0 min-w-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,_#f5f5f7_0%,_#fbfbfd_100%)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
