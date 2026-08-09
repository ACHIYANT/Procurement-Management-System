import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Columns3,
  ListChecks,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Upload,
  UserRound,
  Users,
} from "lucide-react";

import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { patchProcurement, postProcurement, procurementRequest, uploadProcurementFile } from "@/lib/procurement-api";
import {
  getStoredFileName,
  toProcurementFileDownloadUrl,
  toProcurementFileViewUrl,
} from "@/lib/procurement-files";
import { PMS_ROLES, getCurrentUserProfile, getCurrentUserRoles } from "@/lib/roles";
import {
  areWorkRemindersEnabled,
  ensureWorkPushSubscription,
  playReminderSound,
  requestGlobalWorkReminderRefresh,
  runDueWorkReminderNotifications,
  setWorkReminderStorage,
  showWorkReminderNotification,
} from "@/lib/work-reminder-notifications";

const calendarViewOptions = [
  { value: "day", label: "Day", shortcut: "D" },
  { value: "week", label: "Week", shortcut: "W" },
  { value: "month", label: "Month", shortcut: "M" },
  { value: "year", label: "Year", shortcut: "Y" },
  { value: "schedule", label: "Schedule", shortcut: "A" },
  { value: "four_days", label: "4 days", shortcut: "X" },
];

const taskViewOptions = [
  { value: "list", label: "List" },
  { value: "kanban", label: "Kanban" },
  { value: "workload", label: "Workload" },
];

const taskFilterOptions = [
  { value: "inbox", label: "Inbox" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
  { value: "critical", label: "Critical" },
  { value: "assigned_by_me", label: "Assigned by Me" },
  { value: "completed", label: "Completed" },
  { value: "completed_by_me", label: "Done by Me" },
  { value: "personal", label: "Personal" },
  { value: "system", label: "System" },
];

const colorLegendItems = [
  { label: "Critical priority / overdue", helper: "Immediate attention", tone: "critical", dotClass: "bg-rose-600" },
  { label: "High priority", helper: "Important follow-up", tone: "high", dotClass: "bg-amber-500" },
  { label: "Medium / low priority", helper: "Regular work", tone: "normal", dotClass: "bg-[#7986cb]" },
  { label: "Completed", helper: "Finished work", tone: "completed", dotClass: "bg-emerald-600" },
  { label: "Returned", helper: "Sent back with remarks", tone: "returned", dotClass: "bg-orange-500" },
  { label: "System / open", helper: "Auto or active watch", tone: "system", dotClass: "bg-sky-500" },
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const reminderFrequencyOptions = [
  { value: "once", label: "Once" },
  { value: "every_15_minutes", label: "Every 15 minutes" },
  { value: "hourly", label: "Every hour" },
  { value: "every_2_hours", label: "Every 2 hours" },
  { value: "every_6_hours", label: "Every 6 hours" },
  { value: "every_12_hours", label: "Every 12 hours" },
  { value: "every_5_days", label: "Every 5 days" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
];

const taskRepeatOptions = [
  { value: "", label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const taskLinkTypes = [
  { value: "", label: "No linked record" },
  { value: "indent", label: "Indent" },
  { value: "procurement_case", label: "Procurement Case" },
  { value: "tender", label: "Tender" },
];

const emptyForm = {
  title: "",
  description: "",
  due_at: "",
  reminder_at: "",
  reminder_sound: "soft_bell",
  reminder_frequency: "once",
  repeat_rule: "",
  priority: "medium",
  assigned_to_employee_id: "",
  link_type: "",
  linked_record_id: "",
  checklist_text: "",
};

const pad = (value) => String(value).padStart(2, "0");

const toDateKey = (value) => {
  if (!value) return "no-date";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "no-date";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatDate = (value) => {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
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

const toDateTimeLocalValue = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const toDateTimeInputValue = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return toDateTimeLocalValue(date);
};

const getCurrentMinute = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  return now;
};

const isPastDateTime = (value) => {
  if (!value) return false;
  const selected = new Date(value);
  if (Number.isNaN(selected.getTime())) return false;
  return selected.getTime() < getCurrentMinute().getTime();
};

const monthLabel = (date) =>
  date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

const labelize = (value) =>
  String(value || "NA")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const buildMonthDays = (baseDate) => {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      key: toDateKey(date),
      isCurrentMonth: date.getMonth() === month,
      isToday: toDateKey(date) === toDateKey(new Date()),
    };
  });
};

const startOfWeek = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
};

const addCalendarDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addCalendarMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const getCalendarDays = (baseDate, view) => {
  if (view === "day") return [new Date(baseDate)];
  if (view === "four_days") {
    return Array.from({ length: 4 }, (_, index) => addCalendarDays(baseDate, index));
  }
  const weekStart = startOfWeek(baseDate);
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart, index));
};

const getCalendarTitle = (baseDate, view) => {
  if (view === "year") return String(baseDate.getFullYear());
  if (view === "month") return monthLabel(baseDate);
  if (view === "schedule") {
    const end = addCalendarMonths(baseDate, 2);
    return `${baseDate.toLocaleDateString("en-IN", { month: "short" })} - ${end.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`;
  }
  if (view === "day") {
    return baseDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const days = getCalendarDays(baseDate, view);
  const first = days[0];
  const last = days[days.length - 1];
  if (first.getMonth() === last.getMonth()) {
    return `${first.toLocaleDateString("en-IN", { month: "short" })} ${first.getDate()} - ${last.getDate()}, ${last.getFullYear()}`;
  }
  return `${first.toLocaleDateString("en-IN", { month: "short" })} - ${last.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`;
};

const getDateTasks = (tasksByDay, date) => tasksByDay[toDateKey(date)] || [];

const formatCalendarTime = (value) => {
  if (!value) return "All day";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "All day";
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const getHourLabel = (hour) => {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
};

const getIndiaCurrentMinuteParts = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(valueByType.hour === "24" ? "0" : valueByType.hour);

  return {
    dateKey: `${valueByType.year}-${valueByType.month}-${valueByType.day}`,
    hour: Number.isFinite(hour) ? hour : new Date().getHours(),
    minute: Number(valueByType.minute || 0),
  };
};

const getTaskHour = (task) => {
  if (!task?.due_at) return null;
  const date = new Date(task.due_at);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours();
};

const miniMonthDays = (year, month) => buildMonthDays(new Date(year, month, 1));

const getTaskAssigneeNames = (task) => {
  const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
  const names = assignees
    .map((assignee) => assignee.assigned_to_name || assignee.assigned_to_employee?.employee_name)
    .filter(Boolean);
  return names.length ? names.join(", ") : "Self / Unassigned";
};

const getTaskWorkloadParticipants = (task) => {
  const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
  const assignedParticipants = assignees
    .map((assignee) => ({
      key: String(assignee.assigned_to_employee_id || assignee.assigned_to_name || ""),
      name: assignee.assigned_to_name || assignee.assigned_to_employee?.employee_name,
    }))
    .filter((entry) => entry.key || entry.name);

  if (assignedParticipants.length) {
    return assignedParticipants.map((entry) => ({
      key: entry.key || entry.name,
      name: entry.name || `Employee #${entry.key}`,
    }));
  }

  const fallbackId =
    task?.completed_by_employee_id ||
    task?.created_by_employee_id ||
    task?.assigned_by_employee_id ||
    task?.returned_by_employee_id ||
    "self";
  const fallbackName =
    task?.completed_by_employee?.employee_name ||
    task?.created_by_employee?.employee_name ||
    task?.assigned_by_employee?.employee_name ||
    task?.returned_by_employee?.employee_name ||
    task?.completed_by_name ||
    task?.created_by_name ||
    task?.assigned_by_name ||
    task?.returned_by_name ||
    "Self / Unassigned";

  return [{ key: String(fallbackId || fallbackName), name: fallbackName }];
};

const normalizeChecklistItems = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        return { text: item, done: false };
      }
      return {
        text: String(item?.text || item?.title || "").trim(),
        done: Boolean(item?.done || item?.completed),
      };
    })
    .filter((item) => item.text);
};

const buildChecklistFromText = (value) =>
  String(value || "")
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((text) => ({ text, done: false }));

const getTaskComments = (task) => (Array.isArray(task?.comments) ? task.comments : []);

const getTaskAttachments = (task) => (Array.isArray(task?.attachments) ? task.attachments : []);

const isTaskAssignedToEmployee = (task, employeeId) => {
  if (!employeeId) return false;
  return (task?.assignees || []).some(
    (assignee) => String(assignee.assigned_to_employee_id || "") === String(employeeId),
  );
};

const isSelfCreatedByEmployee = (task, employeeId) =>
  Boolean(
    employeeId &&
      task?.origin_type === "self" &&
      String(task.created_by_employee_id || "") === String(employeeId),
  );

const canEditTaskDetails = (task, employeeId, isAdmin) =>
  Boolean(task?.origin_type !== "system" && (isAdmin || isSelfCreatedByEmployee(task, employeeId)));

const canEditTaskReminder = (task, employeeId, isAdmin) =>
  Boolean(
    task?.origin_type !== "system" &&
      (canEditTaskDetails(task, employeeId, isAdmin) ||
        (employeeId &&
          (isTaskAssignedToEmployee(task, employeeId) ||
            String(task?.assigned_by_employee_id || "") === String(employeeId) ||
            String(task?.created_by_employee_id || "") === String(employeeId)))),
  );

const normalizeTasks = (data) => (Array.isArray(data) ? data : data?.rows || []);

const getEmployeeName = (employee) =>
  employee?.employee_name || employee?.fullname || employee?.name || `Employee #${employee?.id}`;

const getIndentLabel = (indent) => {
  const reference = indent?.system_indent_no || indent?.indent_no || `Indent #${indent?.id}`;
  const department = indent?.department_name ? ` - ${indent.department_name}` : "";
  return `${reference}${department}`;
};

const getProcurementCaseLabel = (procurementCase) => {
  const reference = procurementCase?.case_no || `Case #${procurementCase?.id}`;
  const title = procurementCase?.title ? ` - ${procurementCase.title}` : "";
  return `${reference}${title}`;
};

const getTenderLabel = (tender) => {
  const reference =
    tender?.portal_bid_no ||
    tender?.tender_reference_no ||
    tender?.portal_tender_id ||
    `Tender #${tender?.id}`;
  const title = tender?.tender_title ? ` - ${tender.tender_title}` : "";
  return `${reference}${title}`;
};

const buildLinkOption = (type, record) => {
  if (!record?.id) return null;

  if (type === "indent") {
    return {
      id: String(record.id),
      label: getIndentLabel(record),
      module_key: "indents",
      entity_type: "indent",
      entity_id: String(record.id),
      linked_reference: getIndentLabel(record),
      linked_url: `/indents/${record.id}`,
    };
  }

  if (type === "procurement_case") {
    return {
      id: String(record.id),
      label: getProcurementCaseLabel(record),
      module_key: "procurementCases",
      entity_type: "procurement_case",
      entity_id: String(record.id),
      linked_reference: getProcurementCaseLabel(record),
      linked_url: `/procurement-cases/${record.id}`,
    };
  }

  if (type === "tender") {
    return {
      id: String(record.id),
      label: getTenderLabel(record),
      module_key: "tenders",
      entity_type: "tender",
      entity_id: String(record.id),
      linked_reference: getTenderLabel(record),
      linked_url: `/tenders/${record.id}`,
    };
  }

  return null;
};

const getTaskLinkType = (task) => {
  if (task?.entity_type === "indent") return "indent";
  if (task?.entity_type === "procurement_case") return "procurement_case";
  if (task?.entity_type === "tender") return "tender";
  return "";
};

const isTaskOverdue = (task) => {
  if (!task?.due_at || ["completed", "cancelled"].includes(task.status)) return false;
  return new Date(task.due_at).getTime() < Date.now();
};

const isTaskDueToday = (task) => task?.due_at && toDateKey(task.due_at) === toDateKey(new Date());

const isTaskUpcoming = (task) => {
  if (!task?.due_at || ["completed", "cancelled"].includes(task.status)) return false;
  const dueAt = new Date(task.due_at).getTime();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  return dueAt > todayEnd.getTime();
};

const addHours = (date, hours) => {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getBrowserStorageValue = (key) => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const getFirstAvailableValue = (...values) =>
  values.find((value) => String(value || "").trim()) || "";

const getSmartTaskAction = (task) => {
  if (!task?.linked_url) return null;

  if (task.system_rule_code === "tender_submission_deadline") {
    return { label: "Extend Tender", href: `${task.linked_url}?action=extend-submission` };
  }
  if (task.system_rule_code === "approval_pending" || task.entity_type === "approval_request") {
    return { label: "Open Approval", href: task.linked_url };
  }
  if (
    /upload|document|copy/i.test(task.title || "") ||
    ["pbg", "emd", "committee"].includes(String(task.module_key || "").toLowerCase())
  ) {
    return { label: "Upload / Review", href: task.linked_url };
  }

  return { label: "Open Record", href: task.linked_url };
};

const getSeverityForPriority = (priority) => {
  if (priority === "critical") return "critical";
  if (priority === "high") return "urgent";
  return "normal";
};

const parseQuickTask = (value) => {
  let text = String(value || "").trim();
  if (!text) return null;

  const lower = text.toLowerCase();
  const priority =
    lower.includes("critical")
      ? "critical"
      : lower.includes("high priority") || /\bhigh\b/.test(lower)
        ? "high"
        : lower.includes("low priority") || /\blow\b/.test(lower)
          ? "low"
          : "medium";

  let dueAt = null;
  const now = new Date();
  const dueDate = new Date(now);

  if (/\btomorrow\b/i.test(text)) {
    dueDate.setDate(dueDate.getDate() + 1);
    dueAt = dueDate;
    text = text.replace(/\btomorrow\b/gi, "");
  } else if (/\btoday\b/i.test(text)) {
    dueAt = dueDate;
    text = text.replace(/\btoday\b/gi, "");
  } else if (/\bnext week\b/i.test(text)) {
    dueDate.setDate(dueDate.getDate() + 7);
    dueAt = dueDate;
    text = text.replace(/\bnext week\b/gi, "");
  }

  const slashDate = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (slashDate) {
    const year = slashDate[3]
      ? Number(slashDate[3].length === 2 ? `20${slashDate[3]}` : slashDate[3])
      : now.getFullYear();
    dueAt = new Date(year, Number(slashDate[2]) - 1, Number(slashDate[1]));
    text = text.replace(slashDate[0], "");
  }

  const timeMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (timeMatch) {
    const target = dueAt || new Date(now);
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] || 0);
    const meridian = timeMatch[3].toLowerCase();
    if (meridian === "pm" && hours < 12) hours += 12;
    if (meridian === "am" && hours === 12) hours = 0;
    target.setHours(hours, minutes, 0, 0);
    dueAt = target;
    text = text.replace(timeMatch[0], "");
  }

  text = text
    .replace(/\b(critical|high priority|medium priority|low priority|high|medium|low)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title: text || String(value || "").trim(),
    due_at: dueAt && !Number.isNaN(dueAt.getTime()) ? toDateTimeLocalValue(dueAt) : "",
    priority,
    severity: getSeverityForPriority(priority),
  };
};

const badgeClass = (tone) => {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    blue: "bg-sky-50 text-sky-700 ring-sky-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    red: "bg-rose-50 text-rose-700 ring-rose-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    black: "bg-black text-white ring-black",
  };
  return tones[tone] || tones.slate;
};

const priorityTone = (priority) => {
  if (priority === "critical") return "red";
  if (priority === "high") return "amber";
  if (priority === "low") return "blue";
  return "slate";
};

const statusTone = (status) => {
  if (status === "completed") return "green";
  if (status === "returned") return "red";
  if (status === "in_progress") return "blue";
  if (status === "cancelled") return "slate";
  return "amber";
};

function Pill({ children, tone = "slate" }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${badgeClass(tone)}`}>
      {children}
    </span>
  );
}

function ColorLegend() {
  return (
    <div className="pms-work-legend mb-4 rounded-[1.25rem] border border-black/8 bg-white px-4 py-3 shadow-[0_16px_45px_-36px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap gap-2">
        {colorLegendItems.map((item) => (
          <div
            key={item.label}
            className="pms-work-legend-chip flex items-center gap-2 rounded-full border border-black/8 bg-[#f8fafd] px-3 py-2 text-xs"
            title={item.helper}
          >
            <span className={`pms-work-legend-dot pms-work-legend-dot-${item.tone} h-2.5 w-2.5 shrink-0 rounded-full ${item.dotClass}`} />
            <span className="pms-work-legend-label font-semibold text-black/74">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const openNativeDateTimePicker = (event) => {
  const input = event.currentTarget;
  if (typeof input.showPicker !== "function") return;

  try {
    input.showPicker();
  } catch {
    // Some browsers restrict showPicker during synthetic focus; click still works.
  }
};

function DateTimePicker({ label, value, onChange, allowClear = false }) {
  const minimumDateTime = toDateTimeLocalValue(getCurrentMinute());
  const shouldApplyMinimum = !value || !isPastDateTime(value);
  const handleChange = (event) => {
    const nextValue = event.target.value;
    if (isPastDateTime(nextValue)) {
      onChange(toDateTimeLocalValue(getCurrentMinute()));
      return;
    }
    onChange(nextValue);
  };

  return (
    <label className="space-y-1.5">
      <span className="flex items-center justify-between gap-3 text-sm font-medium text-black/70">
        <span>{label}</span>
        {allowClear && value ? (
          <button
            type="button"
            className="text-xs font-semibold text-[#0071e3]"
            onClick={() => onChange("")}
          >
            Clear
          </button>
        ) : null}
      </span>
      <Input
        type="datetime-local"
        value={value}
        min={shouldApplyMinimum ? minimumDateTime : undefined}
        step="60"
        onChange={handleChange}
        onClick={openNativeDateTimePicker}
        onFocus={openNativeDateTimePicker}
        onKeyDown={(event) => event.preventDefault()}
        onBeforeInput={(event) => event.preventDefault()}
        onPaste={(event) => event.preventDefault()}
        onDrop={(event) => event.preventDefault()}
        className="cursor-pointer caret-transparent"
      />
    </label>
  );
}

function CalendarTimedView({ days, tasksByDay, onTaskClick }) {
  const scrollBoxRef = useRef(null);
  const [currentMinuteParts, setCurrentMinuteParts] = useState(() => getIndiaCurrentMinuteParts());
  const hours = Array.from({ length: 24 }, (_, index) => index);
  const timeColumnWidth = 74;
  const dayColumnMinWidth = days.length >= 7 ? 190 : days.length >= 4 ? 220 : 280;
  const gridTemplateColumns = `${timeColumnWidth}px repeat(${days.length}, minmax(${dayColumnMinWidth}px, 1fr))`;
  const gridStyle = {
    gridTemplateColumns,
    minWidth: `${timeColumnWidth + days.length * dayColumnMinWidth}px`,
  };
  const currentHour = currentMinuteParts.hour;
  const currentMinute = currentMinuteParts.minute;
  const todayKey = currentMinuteParts.dateKey;
  const visibleToday = days.some((day) => toDateKey(day) === todayKey);
  const daysRangeKey = days.map((day) => toDateKey(day)).join("|");

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentMinuteParts(getIndiaCurrentMinuteParts());
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  useLayoutEffect(() => {
    if (!visibleToday) return undefined;

    const focusCurrentTime = (behavior = "smooth") => {
      const scrollBox = scrollBoxRef.current;
      const currentHourRow = scrollBox?.querySelector(`[data-hour-row="${currentHour}"]`);
      if (!scrollBox || !currentHourRow) return;

      const rowRect = currentHourRow.getBoundingClientRect();
      const scrollBoxRect = scrollBox.getBoundingClientRect();
      const rowHeight = rowRect.height || currentHourRow.offsetHeight || 68;
      const rowTopInsideScrollBox = rowRect.top - scrollBoxRect.top + scrollBox.scrollTop;
      const currentTimeTop = rowTopInsideScrollBox + (rowHeight * currentMinute) / 60;
      const centeredTop = currentTimeTop - scrollBox.clientHeight / 2;
      const maxTop = Math.max(scrollBox.scrollHeight - scrollBox.clientHeight, 0);
      const targetTop = Math.min(Math.max(centeredTop, 0), maxTop);

      if (Math.abs(scrollBox.scrollTop - targetTop) < 2) return;
      scrollBox.scrollTo({ top: targetTop, behavior });
    };

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => focusCurrentTime("smooth"));
    });
    const settleTimer = window.setTimeout(() => focusCurrentTime("smooth"), 650);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
    };
  }, [currentHour, currentMinute, daysRangeKey, visibleToday]);

  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-black/8 bg-white">
      <div ref={scrollBoxRef} className="max-h-[760px] overflow-auto [overflow-anchor:none]">
        <div
          className="sticky top-0 z-10 grid min-w-full border-b border-black/8 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]"
          style={gridStyle}
        >
          <div
            className="sticky left-0 z-20 bg-white px-3 py-3 shadow-[1px_0_0_rgba(0,0,0,0.08)]"
            aria-hidden="true"
          />
          {days.map((day) => {
            const dayTasks = getDateTasks(tasksByDay, day);
            const isToday = toDateKey(day) === todayKey;
            return (
              <div key={toDateKey(day)} className="overflow-hidden border-l border-black/8 px-3 py-3 text-center">
                <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isToday ? "text-[#0b57d0]" : "text-black/50"}`}>
                  {day.toLocaleDateString("en-IN", { weekday: "short" })}
                </p>
                <div className={`mx-auto mt-1 grid h-11 w-11 place-items-center rounded-full text-2xl ${isToday ? "bg-[#0b57d0] text-white" : "text-black/80"}`}>
                  {day.getDate()}
                </div>
                {dayTasks.length ? (
                  <div className="mx-auto mt-2 max-w-[150px] truncate rounded-lg bg-[#dfe5ee] px-2 py-1 text-center text-xs font-semibold text-[#17324d]">
                    {dayTasks.length} pending task{dayTasks.length > 1 ? "s" : ""}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {hours.map((hour) => (
          <div
            key={hour}
            data-hour-row={hour}
            className="grid min-h-[68px] min-w-full border-b border-black/8 last:border-b-0"
            style={gridStyle}
          >
            <div className="sticky left-0 z-10 bg-white px-3 py-2 text-right text-xs text-black/48 shadow-[1px_0_0_rgba(0,0,0,0.08)]">
              {getHourLabel(hour)}
            </div>
            {days.map((day) => {
              const hourTasks = getDateTasks(tasksByDay, day).filter((task) => getTaskHour(task) === hour);
              return (
                <div key={`${toDateKey(day)}-${hour}`} className="overflow-hidden border-l border-black/8 p-1.5">
                  {hourTasks.slice(0, 3).map((task) => (
                    <button
                      type="button"
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={`mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold leading-4 text-white shadow-sm transition hover:brightness-95 ${
                        task.priority === "critical" ? "bg-rose-600" : task.priority === "high" ? "bg-amber-600" : "bg-[#7986cb]"
                      }`}
                      title={task.title}
                    >
                      <span className="line-clamp-2">{task.title}</span>
                      <span className="block text-white/78">{formatCalendarTime(task.due_at)}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarMonthView({ days, tasksByDay, onSelectDate, onTaskClick }) {
  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-[1.6rem] border border-black/8 bg-white">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
        <div key={day} className="bg-[#f8fafd] px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-black/48">
          {day}
        </div>
      ))}
      {days.map((day) => {
        const dayTasks = getDateTasks(tasksByDay, day.date);
        return (
          <div
            key={day.key}
            onClick={() => onSelectDate(day.date)}
            className={`min-h-[132px] cursor-pointer border-t border-black/8 p-2 text-left transition hover:bg-[#f8fafd] ${
              day.isCurrentMonth ? "bg-white" : "bg-[#fbfbfc] text-black/35"
            }`}
          >
            <div className="flex justify-center">
              <span className={`grid h-7 w-7 place-items-center rounded-full text-sm font-semibold ${day.isToday ? "bg-[#0b57d0] text-white" : ""}`}>
                {day.date.getDate()}
              </span>
            </div>
            <div className="mt-2 space-y-1">
              {dayTasks.slice(0, 4).map((task) => (
                <button
                  type="button"
                  key={task.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onTaskClick(task);
                  }}
                  className={`block w-full truncate rounded-md px-2 py-1 text-left text-xs font-semibold transition hover:brightness-95 ${
                    task.priority === "critical" ? "bg-rose-100 text-rose-700" : task.priority === "high" ? "bg-amber-100 text-amber-700" : "bg-[#e8eaf6] text-[#38427d]"
                  }`}
                >
                  {task.title}
                </button>
              ))}
              {dayTasks.length > 4 ? <span className="text-xs font-semibold text-black/42">+{dayTasks.length - 4} more</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarScheduleView({ groups, onTaskClick }) {
  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-black/8 bg-white">
      {groups.length ? (
        groups.map((group) => (
          <div key={group.key} className="grid border-b border-black/8 last:border-b-0 md:grid-cols-[132px_160px_1fr]">
            <div className="p-4">
              <p className="text-2xl font-semibold">{group.key === "no-date" ? "-" : new Date(group.key).getDate()}</p>
              <p className="text-xs uppercase tracking-[0.16em] text-black/48">{group.label}</p>
            </div>
            <div className="space-y-2 p-4">
              {group.rows.map((task) => (
                <div key={`${task.id}-time`} className="flex items-center gap-2 text-sm">
                  <span className={`h-3 w-3 rounded-full ${task.priority === "critical" ? "bg-rose-600" : task.priority === "high" ? "bg-amber-600" : "bg-[#7986cb]"}`} />
                  {formatCalendarTime(task.due_at)}
                </div>
              ))}
            </div>
            <div className="space-y-2 p-4">
              {group.rows.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onTaskClick(task)}
                  className="w-full rounded-2xl bg-[#f8fafd] px-3 py-2 text-left text-sm transition hover:bg-[#edf2fb]"
                >
                  <p className="font-semibold">{task.title}</p>
                  <p className="mt-1 text-xs text-black/48">{getTaskAssigneeNames(task)}</p>
                </button>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="p-8 text-center text-sm text-black/42">No scheduled tasks for this filter.</div>
      )}
    </div>
  );
}

function CalendarYearView({ baseDate, tasksByDay, selectedDate, onSelectDate, onTaskClick }) {
  const year = baseDate.getFullYear();
  const selectedTasks = selectedDate ? getDateTasks(tasksByDay, selectedDate) : [];

  return (
    <div className="space-y-4 rounded-[1.6rem] border border-black/8 bg-white p-5">
      <div className="grid gap-x-10 gap-y-8 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, month) => (
          <div key={month}>
            <h3 className="mb-3 text-lg font-semibold">
              {new Date(year, month, 1).toLocaleDateString("en-IN", { month: "long" })}
            </h3>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                <span key={`${day}-${index}`} className="py-1 text-black/44">{day}</span>
              ))}
              {miniMonthDays(year, month).map((day) => {
                const dayTasks = getDateTasks(tasksByDay, day.date);
                const isSelected = selectedDate && toDateKey(selectedDate) === day.key;
                return (
                  <button
                    key={`${month}-${day.key}`}
                    type="button"
                    onClick={() => onSelectDate(day.date)}
                    className={`relative grid h-7 place-items-center rounded-full text-xs ${
                      isSelected
                        ? "bg-[#0b57d0] text-white"
                        : day.isToday
                          ? "bg-[#e8f0fe] text-[#0b57d0]"
                          : day.isCurrentMonth
                            ? "text-black/82 hover:bg-[#edf2fb]"
                            : "text-black/28"
                    }`}
                  >
                    {day.date.getDate()}
                    {dayTasks.length ? <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[#7986cb]" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {selectedDate ? (
        <div className="max-w-md rounded-[1.5rem] bg-[#edf2fb] p-4 shadow-[0_18px_45px_-30px_rgba(0,0,0,0.45)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-black/48">
                {selectedDate.toLocaleDateString("en-IN", { weekday: "short" })}
              </p>
              <p className="mt-1 text-3xl font-semibold text-[#0b57d0]">{selectedDate.getDate()}</p>
            </div>
            <button type="button" className="text-xl text-black/48" onClick={() => onSelectDate(null)}>×</button>
          </div>
          <div className="mt-3 space-y-2">
            {selectedTasks.length ? (
              selectedTasks.slice(0, 6).map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onTaskClick(task)}
                  className="w-full truncate rounded-lg bg-white/70 px-3 py-2 text-left text-sm font-semibold transition hover:bg-white"
                >
                  {formatCalendarTime(task.due_at)} {task.title}
                </button>
              ))
            ) : (
              <p className="text-sm text-black/48">No task on this date.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TaskCard({
  task,
  onStatus,
  onReturn,
  onComment,
  onAttachment,
  onChecklistToggle,
  onSnooze,
  onReassign,
  onEdit,
  onEditReminder,
  employees,
  canEdit,
  canEditReminder,
  canReassign,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [reassignTo, setReassignTo] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const overdue = isTaskOverdue(task);
  const checklist = normalizeChecklistItems(task.checklist_json);
  const comments = getTaskComments(task);
  const attachments = getTaskAttachments(task);
  const completedChecklist = checklist.filter((item) => item.done).length;
  const smartAction = getSmartTaskAction(task);
  const isSystemTask = task.origin_type === "system";

  const submitComment = async (event) => {
    event.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed) return;
    await onComment(task, trimmed);
    setCommentText("");
    setDetailsOpen(true);
  };

  const submitReassign = async () => {
    if (!reassignTo) return;
    await onReassign(task, reassignTo);
    setReassignTo("");
  };

  const submitAttachment = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setUploading(true);
      await onAttachment(task, file);
      setDetailsOpen(true);
    } finally {
      setUploading(false);
    }
  };

  return (
    <article className="rounded-[1.7rem] border border-black/8 bg-white p-4 shadow-[0_18px_45px_-36px_rgba(0,0,0,0.55)] transition hover:-translate-y-0.5 hover:shadow-[0_26px_54px_-38px_rgba(0,0,0,0.65)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={statusTone(task.status)}>{labelize(task.status)}</Pill>
            <Pill tone={priorityTone(task.priority)}>{labelize(task.priority)} Priority</Pill>
            {overdue ? <Pill tone="red">Overdue</Pill> : null}
            {task.origin_type === "system" ? <Pill tone="black">System Generated</Pill> : null}
            {task.repeat_rule ? <Pill tone="blue">{labelize(task.repeat_rule)} Repeat</Pill> : null}
            {task.escalation_status === "escalated" ? <Pill tone="red">Escalated</Pill> : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-[#1d1d1f]">
            {task.title}
          </h3>
          {task.description ? (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-black/58">{task.description}</p>
          ) : null}
          <div className="mt-4 grid gap-2 text-sm text-black/62 md:grid-cols-2">
            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-black/36" />
              Due {formatDateTime(task.due_at)}
            </span>
            {canEditReminder ? (
              <button
                type="button"
                className="-ml-2 inline-flex items-center gap-2 rounded-full px-2 py-1 text-left font-medium text-[#0071e3] transition hover:bg-sky-50"
                onClick={() => onEditReminder(task)}
                title="Edit reminder"
              >
                <BellRing className="h-4 w-4 text-[#0071e3]" />
                Reminder {formatDateTime(task.reminder_at)} · {labelize(task.reminder_frequency || "once")}
              </button>
            ) : (
              <span className="inline-flex items-center gap-2">
                <BellRing className="h-4 w-4 text-black/36" />
                Reminder {formatDateTime(task.reminder_at)} · {labelize(task.reminder_frequency || "once")}
              </span>
            )}
            <span className="inline-flex items-center gap-2">
              <UserRound className="h-4 w-4 text-black/36" />
              Assigned to {getTaskAssigneeNames(task)}
            </span>
            <span className="inline-flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-black/36" />
              By {task.assigned_by_name || task.origin_label || "Self"}
            </span>
          </div>
          {task.escalation_reason ? (
            <div className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-700">
              Escalated to {task.escalated_to_name || "authority"}: {task.escalation_reason}
            </div>
          ) : null}
          {task.linked_reference || task.linked_url ? (
            <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-[#f5f5f7] px-3 py-2 text-sm text-[#17324d] sm:flex-row sm:items-center sm:justify-between">
              {task.linked_url ? (
                <a href={task.linked_url} className="font-semibold hover:underline">
                  {task.linked_reference || task.linked_url}
                </a>
              ) : (
                <span className="font-semibold">{task.linked_reference}</span>
              )}
              {smartAction ? (
                <a href={smartAction.href} className="text-xs font-semibold text-[#0071e3] hover:underline">
                  {smartAction.label}
                </a>
              ) : null}
            </div>
          ) : null}
          {checklist.length ? (
            <div className="mt-3 rounded-2xl border border-black/8 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/42">
                  Checklist
                </p>
                <span className="text-xs font-semibold text-black/44">
                  {completedChecklist}/{checklist.length}
                </span>
              </div>
              <div className="mt-2 space-y-2">
                {checklist.map((item, index) => (
                  <label key={`${item.text}-${index}`} className="flex items-start gap-2 text-sm text-black/66">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => onChecklistToggle(task, index)}
                      disabled={isSystemTask}
                      className="mt-1 h-4 w-4 rounded border-black/20"
                    />
                    <span className={item.done ? "line-through text-black/38" : ""}>{item.text}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          {task.return_remarks ? (
            <div className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-700">
              Returned remarks: {task.return_remarks}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 lg:max-w-[310px] lg:justify-end">
          {smartAction ? (
            <Button asChild className="rounded-full bg-black text-white hover:bg-black/85">
              <a href={smartAction.href}>{smartAction.label}</a>
            </Button>
          ) : null}
          {!isSystemTask && (task.status === "open" || task.status === "returned") ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => onStatus(task, "in_progress")}
            >
              Start
            </Button>
          ) : null}
          {!isSystemTask && task.status !== "completed" && task.status !== "cancelled" ? (
            <Button
              type="button"
              className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => onStatus(task, "completed")}
            >
              Complete
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => onEdit(task)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => setDetailsOpen((current) => !current)}
          >
            <MessageSquare className="h-4 w-4" />
            Details
          </Button>
        </div>
      </div>
      {detailsOpen ? (
        <div className="mt-4 grid gap-4 border-t border-black/8 pt-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/42">Attachments</p>
              {attachments.length ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="rounded-2xl bg-[#f5f5f7] px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <Paperclip className="h-4 w-4 shrink-0 text-black/40" />
                        <span className="truncate font-semibold">
                          {attachment.original_file_name || getStoredFileName(attachment.document_path)}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-3 text-xs font-semibold text-[#0071e3]">
                        <a href={toProcurementFileViewUrl(attachment.document_path)} target="_blank" rel="noreferrer">
                          View
                        </a>
                        <a href={toProcurementFileDownloadUrl(attachment.document_path)}>
                          Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-black/42">No attachments yet.</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={submitAttachment}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 rounded-full"
                disabled={uploading || isSystemTask}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading..." : "Attach File"}
              </Button>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/42">Comments</p>
              {comments.length ? (
                <div className="mt-2 space-y-2">
                  {comments.map((comment) => (
                    <div key={comment.id} className="rounded-2xl bg-[#f5f5f7] px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-black/42">
                        <span className="font-semibold">{comment.author_name || "User"}</span>
                        <span>{formatDateTime(comment.created_at)}</span>
                      </div>
                      <p className="mt-1 leading-6 text-black/68">{comment.comment_text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-black/42">No comments yet.</p>
              )}
            </div>
            <form onSubmit={submitComment} className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Add comment or update..."
                disabled={isSystemTask}
              />
              <Button type="submit" disabled={isSystemTask} className="rounded-full bg-black text-white hover:bg-black/85">
                Add Comment
              </Button>
            </form>
          </div>
          <div className="space-y-3 rounded-[1.4rem] bg-[#f5f5f7] p-3">
            {isSystemTask ? (
              <div className="rounded-2xl bg-white px-3 py-3 text-sm leading-6 text-black/58">
                <p className="font-semibold text-black/75">System generated</p>
                <p className="mt-1">
                  This event is read-only. Open the linked module to resolve the source item.
                </p>
              </div>
            ) : null}
            {!isSystemTask && task.status !== "completed" && task.status !== "cancelled" ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/42">
                  Task Actions
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 rounded-full text-rose-700"
                  onClick={() => onReturn(task)}
                >
                  Return with remarks
                </Button>
              </div>
            ) : null}
            {!isSystemTask ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/42">
                  Snooze Reminder
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onSnooze(task, addHours(new Date(), 1))}>
                    1 hour
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onSnooze(task, addDays(new Date(), 1))}>
                    Tomorrow
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onSnooze(task, addDays(new Date(), 7))}>
                    Next week
                  </Button>
                </div>
              </div>
            ) : null}
            {!isSystemTask && canReassign ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/42">
                  Reassign
                </p>
                <div className="mt-2 flex gap-2">
                  <select
                    value={reassignTo}
                    onChange={(event) => setReassignTo(event.target.value)}
                    className="h-9 min-w-0 flex-1 rounded-md border border-black/10 bg-white px-2 text-sm"
                  >
                    <option value="">Select employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {getEmployeeName(employee)}
                      </option>
                    ))}
                  </select>
                  <Button type="button" size="sm" className="rounded-full" disabled={!reassignTo} onClick={submitReassign}>
                    Reassign
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function WorkloadTaskBucket({ title, rows, tone = "slate", emptyText }) {
  const toneClasses = {
    blue: "border-sky-100 bg-sky-50/55 text-sky-700",
    green: "border-emerald-100 bg-emerald-50/55 text-emerald-700",
    red: "border-rose-100 bg-rose-50/55 text-rose-700",
    amber: "border-amber-100 bg-amber-50/55 text-amber-700",
    slate: "border-black/8 bg-white text-black/68",
  };

  return (
    <div className="overflow-hidden rounded-[1.1rem] border border-black/8 bg-white">
      <div className={`flex items-center justify-between gap-3 border-b px-3 py-2 ${toneClasses[tone] || toneClasses.slate}`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{title}</p>
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-white/85 px-2 text-xs font-bold">
          {rows.length}
        </span>
      </div>
      {rows.length ? (
        <div className="max-h-[260px] divide-y divide-black/6 overflow-y-auto">
          {rows.map((task) => (
            <div key={`${title}-${task.id}`} className="px-3 py-2.5 text-sm transition hover:bg-[#f8fafd]">
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 font-semibold leading-5 text-black/78">{task.title}</p>
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                  task.status === "completed"
                    ? "bg-emerald-500"
                    : isTaskOverdue(task)
                      ? "bg-rose-500"
                      : task.priority === "critical" || task.severity === "critical"
                        ? "bg-orange-500"
                        : "bg-sky-500"
                }`} />
              </div>
              <p className="mt-1 text-xs text-black/48">{formatDateTime(task.due_at)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-3 py-8 text-center text-sm text-black/38">{emptyText}</p>
      )}
    </div>
  );
}

const getProfileProcurementEmployeeId = (profile = {}) =>
  profile?.employee_id || profile?.procurement_employee_id || null;

export default function WorkDesk() {
  const [roles] = useState(() => getCurrentUserRoles());
  const [profile] = useState(() => getCurrentUserProfile());
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [linkedRecords, setLinkedRecords] = useState({
    indents: [],
    procurementCases: [],
    tenders: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workMode, setWorkMode] = useState("calendar");
  const [calendarView, setCalendarView] = useState("four_days");
  const [taskView, setTaskView] = useState("list");
  const [activeFilter, setActiveFilter] = useState("inbox");
  const [selectedWorkloadUserKey, setSelectedWorkloadUserKey] = useState("");
  const [quickText, setQuickText] = useState("");
  const [scope, setScope] = useState(() => {
    const currentProfile = getCurrentUserProfile();
    const currentRoles = getCurrentUserRoles();
    const canViewAll =
      currentRoles.includes(PMS_ROLES.ADMIN) || currentRoles.includes(PMS_ROLES.SUPER_ADMIN);
    return !getProfileProcurementEmployeeId(currentProfile) && canViewAll ? "all" : "mine";
  });
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(areWorkRemindersEnabled);
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnRemarks, setReturnRemarks] = useState("");
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [reminderTarget, setReminderTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [reminderForm, setReminderForm] = useState({
    reminder_at: "",
    reminder_sound: "soft_bell",
    reminder_frequency: "once",
  });
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const autoRefreshInFlightRef = useRef(false);

  const actorPayload = useMemo(
    () => ({
      actor_employee_id: getProfileProcurementEmployeeId(profile),
      actor_empcode: profile?.empcode || getBrowserStorageValue("empcode") || "",
      actor_mobile_no:
        profile?.mobile_no ||
        profile?.mobileno ||
        getBrowserStorageValue("mobileno") ||
        "",
      actor_name:
        getFirstAvailableValue(
          profile?.employee_name,
          profile?.fullname,
          getBrowserStorageValue("fullname"),
        ) ||
        "Procurement User",
      actor_roles: roles,
    }),
    [profile, roles],
  );

  const currentEmployeeId = actorPayload.actor_employee_id;
  const canViewAllTasks =
    roles.includes(PMS_ROLES.ADMIN) || roles.includes(PMS_ROLES.SUPER_ADMIN);
  const canAssignTasks = canViewAllTasks;
  const isWorkLocked = !notificationsEnabled;

  const loadData = useCallback(async ({ silent = false, notifyOnError = !silent } = {}) => {
    try {
      if (!silent) setLoading(true);
      const isWorkloadView = workMode === "tasks" && taskView === "workload";
      const isCompletedByMeFilter = !isWorkloadView && activeFilter === "completed_by_me";
      const isCompletedFilter = !isWorkloadView && (activeFilter === "completed" || isCompletedByMeFilter);
      const params = new URLSearchParams({
        status: isWorkloadView ? "all" : isCompletedFilter ? "completed" : "active",
        limit: "500",
      });
      const shouldLoadAllTasks = canViewAllTasks && scope === "all";
      const shouldLoadAllCompletedTasks = isCompletedFilter && shouldLoadAllTasks && !isCompletedByMeFilter;
      const shouldLoadOwnTasks = isCompletedFilter
        ? Boolean(currentEmployeeId)
        : !shouldLoadAllTasks && Boolean(currentEmployeeId);
      const shouldLoadNoTasks = isCompletedFilter
        ? !shouldLoadAllCompletedTasks && !currentEmployeeId
        : !shouldLoadAllTasks && !currentEmployeeId;

      if (isCompletedByMeFilter && currentEmployeeId) {
        params.set("completed_by_employee_id", currentEmployeeId);
      } else if (shouldLoadOwnTasks) {
        params.set("employee_id", currentEmployeeId);
      }

      const taskRequest = (() => {
        if (shouldLoadNoTasks) return Promise.resolve([]);
        if (!isCompletedFilter || shouldLoadAllCompletedTasks) {
          return procurementRequest(`/work-tasks?${params.toString()}`);
        }

        const completedByParams = new URLSearchParams({
          status: "completed",
          limit: "500",
          completed_by_employee_id: currentEmployeeId,
        });
        const assignedCompletedParams = new URLSearchParams({
          status: "completed",
          limit: "500",
          employee_id: currentEmployeeId,
        });

        return Promise.all([
          procurementRequest(`/work-tasks?${completedByParams.toString()}`),
          procurementRequest(`/work-tasks?${assignedCompletedParams.toString()}`),
        ]).then(([completedByRows, assignedRows]) => {
          const merged = new Map();
          [...normalizeTasks(completedByRows), ...normalizeTasks(assignedRows)].forEach((task) => {
            if (task?.id) merged.set(String(task.id), task);
          });
          return Array.from(merged.values());
        });
      })();

      const [nextTasks, nextEmployees, nextIndents, nextCases, nextTenders] = await Promise.all([
        taskRequest,
        procurementRequest("/procurement-employees?activeOnly=true"),
        procurementRequest("/indents?cursorMode=true&limit=250"),
        procurementRequest("/procurement-cases?cursorMode=true&limit=250"),
        procurementRequest("/tenders?cursorMode=true&limit=250"),
      ]);
      setTasks(normalizeTasks(nextTasks));
      setEmployees(Array.isArray(nextEmployees) ? nextEmployees : normalizeTasks(nextEmployees));
      setLinkedRecords({
        indents: normalizeTasks(nextIndents),
        procurementCases: normalizeTasks(nextCases),
        tenders: normalizeTasks(nextTenders),
      });
    } catch (error) {
      if (notifyOnError) {
        setPopup({
          open: true,
          type: "error",
          message: error.message || "Unable to load tasks.",
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [activeFilter, actorPayload.actor_name, canViewAllTasks, currentEmployeeId, scope, taskView, workMode]);

  useEffect(() => {
    const timer = setTimeout(() => loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    const refreshSilently = async () => {
      if (document.visibilityState !== "visible" || autoRefreshInFlightRef.current) return;

      autoRefreshInFlightRef.current = true;
      try {
        await loadData({ silent: true });
      } finally {
        autoRefreshInFlightRef.current = false;
      }
    };

    const interval = window.setInterval(refreshSilently, 15000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshSilently();
    };

    window.addEventListener("focus", refreshSilently);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshSilently);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadData]);

  const visibleTasks = useMemo(() => {
    const actorEmployeeId = currentEmployeeId ? String(currentEmployeeId) : "";
    return tasks.filter((task) => {
      if (activeFilter === "completed") return task.status === "completed";
      if (activeFilter === "completed_by_me") {
        const assignedToActor = Array.isArray(task.assignees)
          && task.assignees.some((assignee) => String(assignee.assigned_to_employee_id || "") === actorEmployeeId);
        const selfCreatedByActor =
          task.origin_type === "self" && String(task.created_by_employee_id || "") === actorEmployeeId;
        return actorEmployeeId
          && (String(task.completed_by_employee_id || "") === actorEmployeeId || assignedToActor || selfCreatedByActor);
      }
      if (activeFilter === "today") return isTaskDueToday(task);
      if (activeFilter === "upcoming") return isTaskUpcoming(task);
      if (activeFilter === "overdue") return isTaskOverdue(task);
      if (activeFilter === "critical") return task.priority === "critical" || task.severity === "critical";
      if (activeFilter === "assigned_by_me") {
        return actorEmployeeId && String(task.assigned_by_employee_id || "") === actorEmployeeId;
      }
      if (activeFilter === "personal") return task.origin_type === "self";
      if (activeFilter === "system") return task.origin_type === "system";
      return true;
    });
  }, [activeFilter, currentEmployeeId, tasks]);

  const selectTaskFilter = (filter) => {
    setActiveFilter(filter);
    if (filter === "completed" || filter === "completed_by_me") {
      setWorkMode("tasks");
      setTaskView("list");
    }
  };

  const tasksByDay = useMemo(() => {
    const grouped = {};
    visibleTasks.forEach((task) => {
      const key = toDateKey(task.due_at);
      grouped[key] = grouped[key] || [];
      grouped[key].push(task);
    });
    return grouped;
  }, [visibleTasks]);

  const monthDays = useMemo(() => buildMonthDays(calendarDate), [calendarDate]);

  const calendarDays = useMemo(
    () => getCalendarDays(calendarDate, calendarView),
    [calendarDate, calendarView],
  );

  const currentViewOptions = workMode === "calendar" ? calendarViewOptions : taskViewOptions;
  const currentViewValue = workMode === "calendar" ? calendarView : taskView;
  const calendarTitle = getCalendarTitle(calendarDate, calendarView);
  const selectedCalendarTasks = selectedCalendarDate ? getDateTasks(tasksByDay, selectedCalendarDate) : [];

  const agendaGroups = useMemo(() => {
    const entries = Object.entries(tasksByDay).sort(([left], [right]) => left.localeCompare(right));
    return entries.map(([key, rows]) => ({
      key,
      label: key === "no-date" ? "No due date" : formatDate(key),
      rows,
    }));
  }, [tasksByDay]);

  const summary = useMemo(() => {
    const todayKey = toDateKey(new Date());
    return {
      open: tasks.filter((task) => task.status === "open").length,
      overdue: tasks.filter(isTaskOverdue).length,
      today: tasks.filter((task) => toDateKey(task.due_at) === todayKey).length,
      returned: tasks.filter((task) => task.status === "returned").length,
      critical: tasks.filter((task) => task.priority === "critical" || task.severity === "critical").length,
    };
  }, [tasks]);

  const kanbanGroups = useMemo(
    () => {
      const groups = [
        {
          key: "open",
          label: "To Start",
          rows: visibleTasks.filter((task) => task.status === "open" || task.status === "returned"),
        },
        {
          key: "in_progress",
          label: "In Progress",
          rows: visibleTasks.filter((task) => task.status === "in_progress" || task.status === "reassigned"),
        },
        {
          key: "critical",
          label: "Critical Watch",
          rows: visibleTasks.filter(
            (task) =>
              isTaskOverdue(task) ||
              task.priority === "critical" ||
              task.severity === "critical" ||
              task.escalation_status === "escalated",
          ),
        },
      ];
      const completedRows = visibleTasks.filter((task) => task.status === "completed");
      if (completedRows.length || activeFilter === "completed" || activeFilter === "completed_by_me") {
        groups.push({
          key: "completed",
          label: "Completed",
          rows: completedRows,
        });
      }
      return groups;
    },
    [activeFilter, visibleTasks],
  );

  const workloadRows = useMemo(() => {
    const rows = new Map();
    const pendingStatuses = new Set(["open", "in_progress", "returned", "reassigned"]);

    tasks.forEach((task) => {
      const participants = getTaskWorkloadParticipants(task);
      const isPending = pendingStatuses.has(task.status);
      const isCompleted = task.status === "completed";

      participants.forEach((participant) => {
        const key = String(participant.key || participant.name || "self");
        const existing = rows.get(key) || {
          key,
          name: participant.name || "Self / Unassigned",
          total: 0,
          pending: 0,
          completed: 0,
          overdue: 0,
          today: 0,
          critical: 0,
          completionRate: 0,
          allTasks: [],
          pendingTasks: [],
          completedTasks: [],
          overdueTasks: [],
          todayTasks: [],
          criticalTasks: [],
        };
        existing.total += 1;
        if (isPending) existing.pending += 1;
        if (isCompleted) existing.completed += 1;
        if (isPending && isTaskOverdue(task)) existing.overdue += 1;
        if (isPending && (task.priority === "critical" || task.severity === "critical")) existing.critical += 1;
        if (isPending && isTaskDueToday(task)) existing.today += 1;
        existing.allTasks.push(task);
        if (isPending) existing.pendingTasks.push(task);
        if (isCompleted) existing.completedTasks.push(task);
        if (isPending && isTaskOverdue(task)) existing.overdueTasks.push(task);
        if (isPending && isTaskDueToday(task)) existing.todayTasks.push(task);
        if (isPending && (task.priority === "critical" || task.severity === "critical")) existing.criticalTasks.push(task);
        rows.set(key, existing);
      });
    });
    return Array.from(rows.values())
      .map((row) => ({
        ...row,
        completionRate: row.total ? Math.round((row.completed / row.total) * 100) : 0,
      }))
      .sort((left, right) => right.pending - left.pending || right.overdue - left.overdue || right.total - left.total);
  }, [tasks]);

  const selectedWorkloadRow = useMemo(
    () => workloadRows.find((row) => row.key === selectedWorkloadUserKey) || null,
    [selectedWorkloadUserKey, workloadRows],
  );

  useEffect(() => {
    if (!notificationsEnabled) return;
    runDueWorkReminderNotifications(tasks);
  }, [notificationsEnabled, tasks]);

  const currentLinkOptions = useMemo(() => {
    const sourceRows = {
      indent: linkedRecords.indents,
      procurement_case: linkedRecords.procurementCases,
      tender: linkedRecords.tenders,
    }[form.link_type] || [];

    return sourceRows.map((record) => buildLinkOption(form.link_type, record)).filter(Boolean);
  }, [form.link_type, linkedRecords]);

  const selectedLink = useMemo(
    () => currentLinkOptions.find((option) => option.id === String(form.linked_record_id || "")) || null,
    [currentLinkOptions, form.linked_record_id],
  );

  const currentEditLinkOptions = useMemo(() => {
    const sourceRows = {
      indent: linkedRecords.indents,
      procurement_case: linkedRecords.procurementCases,
      tender: linkedRecords.tenders,
    }[editForm.link_type] || [];

    return sourceRows.map((record) => buildLinkOption(editForm.link_type, record)).filter(Boolean);
  }, [editForm.link_type, linkedRecords]);

  const selectedEditLink = useMemo(
    () => currentEditLinkOptions.find((option) => option.id === String(editForm.linked_record_id || "")) || null,
    [currentEditLinkOptions, editForm.linked_record_id],
  );

  const updateForm = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const setFormValue = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateEditForm = (field) => (event) => {
    setEditForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const setEditFormValue = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }));
  };

  const updateLinkType = (event) => {
    setForm((current) => ({
      ...current,
      link_type: event.target.value,
      linked_record_id: "",
    }));
  };

  const updateEditLinkType = (event) => {
    setEditForm((current) => ({
      ...current,
      link_type: event.target.value,
      linked_record_id: "",
    }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (isWorkLocked) {
      setPopup({ open: true, type: "error", message: "Enable work alerts before creating tasks." });
      return;
    }
    if (!form.title.trim()) {
      setPopup({ open: true, type: "error", message: "Task title is required." });
      return;
    }
    if (form.link_type && !selectedLink) {
      setPopup({ open: true, type: "error", message: "Please select the linked record." });
      return;
    }
    if (isPastDateTime(form.due_at)) {
      setPopup({ open: true, type: "error", message: "Due date and time cannot be in the past." });
      return;
    }
    if (isPastDateTime(form.reminder_at)) {
      setPopup({ open: true, type: "error", message: "Reminder date and time cannot be in the past." });
      return;
    }

    setSaving(true);
    try {
      const requestedAssigneeId = canAssignTasks
        ? form.assigned_to_employee_id
        : currentEmployeeId;
      const assignedEmployee = employees.find(
        (employee) => String(employee.id) === String(requestedAssigneeId),
      );
      const assignedToSelf =
        !requestedAssigneeId ||
        String(requestedAssigneeId) === String(currentEmployeeId || "");

      await postProcurement("/work-tasks", {
        ...form,
        ...actorPayload,
        origin_type: assignedToSelf ? "self" : "manual_assignment",
        origin_label: assignedToSelf ? "Self Created" : "Assigned by Higher Authority",
        assigned_to_employee_id: requestedAssigneeId || currentEmployeeId,
        assigned_to_name: assignedEmployee ? getEmployeeName(assignedEmployee) : actorPayload.actor_name,
        due_at: form.due_at || null,
        reminder_at: form.reminder_at || null,
        reminder_sound: form.reminder_sound,
        reminder_frequency: form.reminder_frequency || "once",
        repeat_rule: form.repeat_rule || null,
        checklist: buildChecklistFromText(form.checklist_text),
        severity: getSeverityForPriority(form.priority),
        module_key: selectedLink?.module_key || null,
        entity_type: selectedLink?.entity_type || null,
        entity_id: selectedLink?.entity_id || null,
        linked_reference: selectedLink?.linked_reference || null,
        linked_url: selectedLink?.linked_url || null,
      });
      setForm(emptyForm);
      setIsTaskFormOpen(false);
      setPopup({ open: true, type: "success", message: "Task created successfully." });
      await loadData();
      requestGlobalWorkReminderRefresh();
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to create task." });
    } finally {
      setSaving(false);
    }
  };

  const openTaskEditor = (task) => {
    const linkType = getTaskLinkType(task);
    setEditTarget(task);
    setEditForm({
      title: task.title || "",
      description: task.description || "",
      due_at: toDateTimeInputValue(task.due_at),
      reminder_at: toDateTimeInputValue(task.reminder_at),
      reminder_sound: task.reminder_sound || "soft_bell",
      reminder_frequency: task.reminder_frequency || "once",
      repeat_rule: task.repeat_rule || "",
      priority: task.priority || "medium",
      assigned_to_employee_id: "",
      link_type: linkType,
      linked_record_id: linkType ? String(task.entity_id || "") : "",
      checklist_text: normalizeChecklistItems(task.checklist_json)
        .map((item) => item.text)
        .join("\n"),
    });
  };

  const openReminderEditor = (task) => {
    setReminderTarget(task);
    setReminderForm({
      reminder_at: toDateTimeInputValue(task.reminder_at),
      reminder_sound: task.reminder_sound || "soft_bell",
      reminder_frequency: task.reminder_frequency || "once",
    });
  };

  const openTaskFromCalendar = (task) => {
    if (canEditTaskDetails(task, currentEmployeeId, canViewAllTasks)) {
      openTaskEditor(task);
      return;
    }

    if (canEditTaskReminder(task, currentEmployeeId, canViewAllTasks)) {
      openReminderEditor(task);
      return;
    }

    setDetailTarget(task);
  };

  const handleTaskEdit = async (event) => {
    event.preventDefault();
    if (isWorkLocked) {
      setPopup({ open: true, type: "error", message: "Enable work alerts before editing tasks." });
      return;
    }
    if (!editTarget) return;
    if (!editForm.title.trim()) {
      setPopup({ open: true, type: "error", message: "Task title is required." });
      return;
    }
    if (editForm.link_type && !selectedEditLink) {
      setPopup({ open: true, type: "error", message: "Please select the linked record." });
      return;
    }

    const dueChanged = toDateTimeInputValue(editTarget.due_at) !== editForm.due_at;
    const reminderChanged = toDateTimeInputValue(editTarget.reminder_at) !== editForm.reminder_at;
    if (dueChanged && isPastDateTime(editForm.due_at)) {
      setPopup({ open: true, type: "error", message: "Due date and time cannot be in the past." });
      return;
    }
    if (reminderChanged && isPastDateTime(editForm.reminder_at)) {
      setPopup({ open: true, type: "error", message: "Reminder date and time cannot be in the past." });
      return;
    }

    setSaving(true);
    try {
      await patchProcurement(`/work-tasks/${editTarget.id}`, {
        ...actorPayload,
        title: editForm.title,
        description: editForm.description,
        due_at: editForm.due_at || null,
        reminder_at: editForm.reminder_at || null,
        reminder_sound: editForm.reminder_sound,
        reminder_frequency: editForm.reminder_frequency || "once",
        repeat_rule: editForm.repeat_rule || null,
        priority: editForm.priority,
        severity: getSeverityForPriority(editForm.priority),
        checklist: buildChecklistFromText(editForm.checklist_text),
        module_key: selectedEditLink?.module_key || null,
        entity_type: selectedEditLink?.entity_type || null,
        entity_id: selectedEditLink?.entity_id || null,
        linked_reference: selectedEditLink?.linked_reference || null,
        linked_url: selectedEditLink?.linked_url || null,
        remarks: "Task details updated from My Work.",
      });
      setEditTarget(null);
      setEditForm(emptyForm);
      setPopup({ open: true, type: "success", message: "Task updated successfully." });
      await loadData();
      requestGlobalWorkReminderRefresh();
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to update task." });
    } finally {
      setSaving(false);
    }
  };

  const handleReminderEdit = async (event) => {
    event.preventDefault();
    if (isWorkLocked) {
      setPopup({ open: true, type: "error", message: "Enable work alerts before editing reminders." });
      return;
    }
    if (!reminderTarget) return;

    const reminderChanged = toDateTimeInputValue(reminderTarget.reminder_at) !== reminderForm.reminder_at;
    if (reminderChanged && isPastDateTime(reminderForm.reminder_at)) {
      setPopup({ open: true, type: "error", message: "Reminder date and time cannot be in the past." });
      return;
    }

    setSaving(true);
    try {
      await patchProcurement(`/work-tasks/${reminderTarget.id}`, {
        ...actorPayload,
        reminder_at: reminderForm.reminder_at || null,
        reminder_sound: reminderForm.reminder_sound,
        reminder_frequency: reminderForm.reminder_frequency || "once",
        remarks: "Reminder settings updated from My Work.",
      });
      setReminderTarget(null);
      setReminderForm({
        reminder_at: "",
        reminder_sound: "soft_bell",
        reminder_frequency: "once",
      });
      setPopup({ open: true, type: "success", message: "Reminder updated successfully." });
      await loadData();
      requestGlobalWorkReminderRefresh();
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to update reminder." });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickCreate = async (event) => {
    event.preventDefault();
    if (isWorkLocked) {
      setPopup({ open: true, type: "error", message: "Enable work alerts before adding tasks." });
      return;
    }
    const parsed = parseQuickTask(quickText);
    if (!parsed?.title) {
      setPopup({ open: true, type: "error", message: "Write a task first." });
      return;
    }
    if (isPastDateTime(parsed.due_at)) {
      setPopup({
        open: true,
        type: "error",
        message: "Quick task date/time is in the past. Please use a future time.",
      });
      return;
    }

    setSaving(true);
    try {
      await postProcurement("/work-tasks", {
        ...actorPayload,
        title: parsed.title,
        due_at: parsed.due_at || null,
        reminder_at: parsed.due_at ? addHours(new Date(parsed.due_at), -1).toISOString() : null,
        reminder_frequency: "once",
        priority: parsed.priority,
        severity: parsed.severity,
        origin_type: "self",
        origin_label: "Self Created",
        assigned_to_employee_id: currentEmployeeId,
        assigned_to_name: actorPayload.actor_name,
      });
      setQuickText("");
      setPopup({ open: true, type: "success", message: "Quick task added." });
      await loadData();
      requestGlobalWorkReminderRefresh();
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to create quick task." });
    } finally {
      setSaving(false);
    }
  };

  const enableReminderNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPopup({ open: true, type: "error", message: "Browser notifications are not supported here." });
      return;
    }

    try {
      const permission = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      if (permission !== "granted") {
        setWorkReminderStorage(false);
        setNotificationsEnabled(false);
        setPopup({
          open: true,
          type: "error",
          message: "Notification permission was not granted. Please allow notifications in browser settings to use My Work.",
        });
        return;
      }

      setWorkReminderStorage(true);
      setNotificationsEnabled(true);
      let pushResult = { enabled: false, reason: "not_checked" };
      let nativeTestShown = false;

      try {
        pushResult = await ensureWorkPushSubscription({ employeeId: currentEmployeeId });
      } catch {
        pushResult = { enabled: false, reason: "subscription_failed" };
      }

      try {
        await showWorkReminderNotification({
          id: "permission-test",
          title: "PMS reminders enabled",
          due_at: new Date().toISOString(),
          linked_reference: "You will receive native notification cards for due reminders.",
          linked_url: "/my-work",
          priority: "medium",
          severity: "normal",
          reminder_sound: "soft_bell",
        });
        nativeTestShown = true;
      } catch {
        nativeTestShown = false;
      }

      try {
        playReminderSound();
      } catch {
        // Sound is optional; notification permission is the actual requirement.
      }

      setPopup({
        open: true,
        type: nativeTestShown ? "success" : "warning",
        message: nativeTestShown
          ? pushResult.enabled
            ? "Work reminders, native notification cards, sound alerts, and background push notifications enabled."
            : "Work reminders and native notification cards enabled. Server push is not configured yet, so closed-browser reminders may still depend on browser support."
          : "Work reminders are enabled, but Windows/Chrome did not show the native test card. Please check Windows Notifications, Focus Assist/Do Not Disturb, and Chrome site notification settings.",
      });
    } catch {
      setWorkReminderStorage(false);
      setNotificationsEnabled(false);
      setPopup({
        open: true,
        type: "error",
        message: "Unable to enable browser notifications. Open this app on localhost/HTTPS and allow notifications.",
      });
    }
  };

  const updateTaskStatus = async (task, status) => {
    if (isWorkLocked) {
      setPopup({ open: true, type: "error", message: "Enable work alerts before updating tasks." });
      return;
    }
    try {
      await procurementRequest(`/work-tasks/${task.id}/status/${status}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...actorPayload,
          remarks: status === "completed" ? "Marked complete from My Work." : "Status updated from My Work.",
        }),
      });
      setPopup({ open: true, type: "success", message: `Task marked ${labelize(status)}.` });
      await loadData();
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to update task." });
    }
  };

  const addTaskComment = async (task, commentText) => {
    if (isWorkLocked) {
      setPopup({ open: true, type: "error", message: "Enable work alerts before commenting on tasks." });
      return;
    }
    try {
      await postProcurement(`/work-tasks/${task.id}/comments`, {
        ...actorPayload,
        comment_text: commentText,
      });
      setPopup({ open: true, type: "success", message: "Comment added." });
      await loadData();
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to add comment." });
    }
  };

  const addTaskAttachment = async (task, file) => {
    if (isWorkLocked) {
      setPopup({ open: true, type: "error", message: "Enable work alerts before attaching files." });
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("filename_base", `${task.id}-${file.name}`);
      const uploaded = await uploadProcurementFile("/files/upload/work_task_attachment", formData);
      await postProcurement(`/work-tasks/${task.id}/attachments`, {
        ...actorPayload,
        document_path: uploaded.path,
        original_file_name: uploaded.originalName || file.name,
        file_size: uploaded.size || file.size,
        mime_type: uploaded.mimeType || file.type,
      });
      setPopup({ open: true, type: "success", message: "Attachment added." });
      await loadData();
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to add attachment." });
    }
  };

  const toggleChecklistItem = async (task, index) => {
    if (isWorkLocked) {
      setPopup({ open: true, type: "error", message: "Enable work alerts before updating checklist items." });
      return;
    }
    const checklist = normalizeChecklistItems(task.checklist_json);
    const nextChecklist = checklist.map((item, itemIndex) =>
      itemIndex === index ? { ...item, done: !item.done } : item,
    );
    try {
      await patchProcurement(`/work-tasks/${task.id}`, {
        ...actorPayload,
        checklist: nextChecklist,
        remarks: "Checklist updated from My Work.",
      });
      await loadData();
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to update checklist." });
    }
  };

  const snoozeTask = async (task, nextReminderAt) => {
    if (isWorkLocked) {
      setPopup({ open: true, type: "error", message: "Enable work alerts before snoozing reminders." });
      return;
    }
    try {
      await postProcurement(`/work-tasks/${task.id}/snooze`, {
        ...actorPayload,
        reminder_at: nextReminderAt.toISOString(),
      });
      setPopup({ open: true, type: "success", message: "Reminder snoozed." });
      await loadData();
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to snooze reminder." });
    }
  };

  const reassignTask = async (task, employeeId) => {
    if (isWorkLocked) {
      setPopup({ open: true, type: "error", message: "Enable work alerts before reassigning tasks." });
      return;
    }
    const employee = employees.find((row) => String(row.id) === String(employeeId));
    try {
      await postProcurement(`/work-tasks/${task.id}/reassign`, {
        ...actorPayload,
        assigned_to_employee_id: employeeId,
        assigned_to_name: employee ? getEmployeeName(employee) : undefined,
        remarks: "Task reassigned from My Work.",
      });
      setPopup({ open: true, type: "success", message: "Task reassigned." });
      await loadData();
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to reassign task." });
    }
  };

  const submitReturn = async (event) => {
    event.preventDefault();
    if (isWorkLocked) {
      setPopup({ open: true, type: "error", message: "Enable work alerts before returning tasks." });
      return;
    }
    if (!returnTarget || !returnRemarks.trim()) {
      setPopup({ open: true, type: "error", message: "Please enter return remarks." });
      return;
    }

    try {
      await postProcurement(`/work-tasks/${returnTarget.id}/return`, {
        ...actorPayload,
        reason: "Wrongly assigned / needs correction",
        remarks: returnRemarks,
      });
      setReturnTarget(null);
      setReturnRemarks("");
      setPopup({ open: true, type: "success", message: "Task returned with remarks." });
      await loadData();
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to return task." });
    }
  };

  const moveCalendar = (offset) => {
    setCalendarDate((current) => {
      if (calendarView === "day") return addCalendarDays(current, offset);
      if (calendarView === "four_days") return addCalendarDays(current, offset * 4);
      if (calendarView === "week") return addCalendarDays(current, offset * 7);
      if (calendarView === "year") return new Date(current.getFullYear() + offset, current.getMonth(), 1);
      if (calendarView === "schedule") return addCalendarMonths(current, offset * 3);
      return addCalendarMonths(current, offset);
    });
    setSelectedCalendarDate(null);
  };

  const goToday = () => {
    setCalendarDate(new Date());
    setSelectedCalendarDate(null);
  };

  const updateCurrentView = (value) => {
    if (workMode === "calendar") {
      setCalendarView(value);
      setSelectedCalendarDate(null);
      return;
    }
    setTaskView(value);
  };

  return (
    <>
      <div className="min-h-full bg-[#f5f5f7] px-4 py-7 text-[#1d1d1f]">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="overflow-hidden rounded-[1.6rem] bg-[#121316] text-white shadow-[0_28px_70px_-48px_rgba(0,0,0,0.75)]">
            <div className="flex flex-col gap-5 p-5 md:flex-row md:items-end md:justify-between lg:p-6">
              <div className="max-w-4xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-white/50">
                  My Work
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] md:text-4xl">
                  Tasks, reminders, and procurement deadlines in one place.
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/68">
                  See who assigned the task, whether it is system generated, and return wrongly assigned work with clear remarks.
                </p>
              </div>
              <Button
                type="button"
                className="self-end rounded-full bg-[#0071e3] px-5 text-white hover:bg-[#0066cc]"
                disabled={isWorkLocked}
                onClick={() => setIsTaskFormOpen(true)}
              >
                <Plus className="h-4 w-4" />
                New
              </Button>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-5">
            {[
              { label: "Open", value: summary.open, icon: ListChecks, tone: "bg-sky-50 text-sky-700" },
              { label: "Overdue", value: summary.overdue, icon: AlertTriangle, tone: "bg-rose-50 text-rose-700" },
              { label: "Due Today", value: summary.today, icon: Clock3, tone: "bg-amber-50 text-amber-700" },
              { label: "Returned", value: summary.returned, icon: RotateCcw, tone: "bg-orange-50 text-orange-700" },
              {
                label: activeFilter === "completed"
                  ? "Completed"
                  : activeFilter === "completed_by_me"
                    ? "Done by Me"
                    : "All Active",
                value: tasks.length,
                icon: CalendarDays,
                tone: "bg-emerald-50 text-emerald-700",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-[1.4rem] bg-white p-4 ring-1 ring-black/8">
                  <div className={`grid h-10 w-10 place-items-center rounded-2xl ${item.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.28em] text-black/38">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{item.value}</p>
                </div>
              );
            })}
          </section>

          <section className="overflow-hidden rounded-[2rem] bg-white ring-1 ring-black/8">
            <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-black/40">
                  Quick Capture
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.04em]">
                  Type naturally, we will understand the basics.
                </h2>
                <p className="mt-1 text-sm text-black/50">
                  Example: reply to supplier letter tomorrow 11 AM high priority
                </p>
              </div>
              <form onSubmit={handleQuickCreate} className="flex w-full flex-col gap-2 sm:min-w-[520px] sm:flex-row">
                <Input
                  value={quickText}
                  onChange={(event) => setQuickText(event.target.value)}
                  placeholder="Prepare report tomorrow 4 PM critical"
                  disabled={isWorkLocked}
                  className="h-11 rounded-full px-4"
                />
                <Button
                  type="submit"
                  disabled={saving || isWorkLocked}
                  className="h-11 rounded-full bg-[#0071e3] px-5 text-white hover:bg-[#0066cc]"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </form>
            </div>
          </section>

          <section>
            <section className="rounded-[2rem] bg-white ring-1 ring-black/8">
              <div className="flex flex-col gap-4 border-b border-black/8 p-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" className="rounded-full" onClick={goToday}>
                    Today
                  </Button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveCalendar(-1)}
                      className="grid h-10 w-10 place-items-center rounded-full text-black/70 transition hover:bg-black/6"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCalendar(1)}
                      className="grid h-10 w-10 place-items-center rounded-full text-black/70 transition hover:bg-black/6"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                  <h2 className="min-w-[180px] text-2xl font-semibold tracking-[-0.04em]">
                    {workMode === "calendar" ? calendarTitle : "My Tasks"}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={currentViewValue}
                    onChange={(event) => updateCurrentView(event.target.value)}
                    className="h-10 rounded-full border border-black/18 bg-white px-4 text-sm font-semibold shadow-sm"
                  >
                    {currentViewOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex overflow-hidden rounded-full border border-black/18 bg-white shadow-sm">
                    <button
                      type="button"
                      title="Switch to Calendar"
                      onClick={() => setWorkMode("calendar")}
                      className={`grid h-10 w-12 place-items-center transition ${
                        workMode === "calendar" ? "bg-sky-100 text-[#0b57d0]" : "text-black/62 hover:bg-black/6"
                      }`}
                    >
                      <CalendarDays className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      title="Switch to Tasks"
                      onClick={() => setWorkMode("tasks")}
                      className={`grid h-10 w-12 place-items-center border-l border-black/12 transition ${
                        workMode === "tasks" ? "bg-sky-100 text-[#0b57d0]" : "text-black/62 hover:bg-black/6"
                      }`}
                    >
                      <CheckCircle2 className="h-5 w-5" />
                    </button>
                  </div>
                  {isWorkLocked ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                      onClick={enableReminderNotifications}
                    >
                      <BellRing className="h-4 w-4" />
                      Enable Alerts
                    </Button>
                  ) : null}
                  <select
                    value={scope}
                    onChange={(event) => setScope(event.target.value)}
                    className="h-10 rounded-full border border-black/10 bg-white px-3 text-sm"
                  >
                    <option value="mine">My tasks</option>
                    {canViewAllTasks ? <option value="all">All tasks</option> : null}
                  </select>
                  <select
                    value={activeFilter}
                    onChange={(event) => selectTaskFilter(event.target.value)}
                    className="h-10 rounded-full border border-black/10 bg-white px-3 text-sm font-semibold shadow-sm"
                    title="Task filter"
                  >
                    {taskFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        Filter: {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-5">
                <ColorLegend />
                {isWorkLocked ? (
                  <div className="mb-4 flex flex-col gap-3 rounded-[1.35rem] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700">
                        <BellRing className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold">Alerts are off. Viewing is allowed, but task actions are locked.</p>
                        <p className="mt-1 text-sm text-amber-900/70">
                          Enable alerts before creating, completing, returning, reassigning, commenting, or attaching files.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="rounded-full bg-amber-700 px-5 text-white hover:bg-amber-800"
                      onClick={enableReminderNotifications}
                    >
                      <BellRing className="h-4 w-4" />
                      Enable Work Alerts
                    </Button>
                  </div>
                ) : null}
                {loading ? (
                  <div className="grid min-h-[320px] place-items-center text-sm text-black/50">
                    Loading work desk...
                  </div>
                ) : workMode === "calendar" ? (
                  <div className="space-y-4">
                    {["day", "four_days", "week"].includes(calendarView) ? (
                      <CalendarTimedView
                        days={calendarDays}
                        tasksByDay={tasksByDay}
                        onTaskClick={openTaskFromCalendar}
                      />
                    ) : null}

                    {calendarView === "month" ? (
                      <>
                        <CalendarMonthView
                          days={monthDays}
                          tasksByDay={tasksByDay}
                          onSelectDate={setSelectedCalendarDate}
                          onTaskClick={openTaskFromCalendar}
                        />
                        {selectedCalendarDate ? (
                          <div className="max-w-xl rounded-[1.5rem] bg-[#edf2fb] p-4 shadow-[0_18px_45px_-34px_rgba(0,0,0,0.45)]">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/48">
                                  {selectedCalendarDate.toLocaleDateString("en-IN", {
                                    weekday: "short",
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </p>
                                <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                                  {selectedCalendarTasks.length
                                    ? `${selectedCalendarTasks.length} task${selectedCalendarTasks.length > 1 ? "s" : ""}`
                                    : "No task on this date"}
                                </h3>
                              </div>
                              <button
                                type="button"
                                className="text-xl text-black/48 transition hover:text-black"
                                onClick={() => setSelectedCalendarDate(null)}
                              >
                                ×
                              </button>
                            </div>
                            <div className="mt-3 space-y-2">
                              {selectedCalendarTasks.length ? (
                                selectedCalendarTasks.slice(0, 8).map((task) => (
                                  <button
                                    key={task.id}
                                    type="button"
                                    onClick={() => openTaskFromCalendar(task)}
                                    className="w-full rounded-xl bg-white/75 px-3 py-2 text-left text-sm transition hover:bg-white"
                                  >
                                    <p className="font-semibold">{task.title}</p>
                                    <p className="mt-1 text-xs text-black/48">
                                      {formatCalendarTime(task.due_at)} · {getTaskAssigneeNames(task)}
                                    </p>
                                  </button>
                                ))
                              ) : (
                                <p className="text-sm text-black/48">Click another date or add a task for this day.</p>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null}

                    {calendarView === "year" ? (
                      <CalendarYearView
                        baseDate={calendarDate}
                        tasksByDay={tasksByDay}
                        selectedDate={selectedCalendarDate}
                        onSelectDate={setSelectedCalendarDate}
                        onTaskClick={openTaskFromCalendar}
                      />
                    ) : null}

                    {calendarView === "schedule" ? (
                      <CalendarScheduleView groups={agendaGroups} onTaskClick={openTaskFromCalendar} />
                    ) : null}
                  </div>
                ) : taskView === "workload" || visibleTasks.length ? (
                  <>
                    {taskView === "list" ? (
                      <div className="space-y-3">
                        {visibleTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onStatus={updateTaskStatus}
                            onComment={addTaskComment}
                            onAttachment={addTaskAttachment}
                            onChecklistToggle={toggleChecklistItem}
                            onSnooze={snoozeTask}
                            onReassign={reassignTask}
                            onEdit={openTaskEditor}
                            onEditReminder={openReminderEditor}
                            employees={employees}
                            canEdit={canEditTaskDetails(task, currentEmployeeId, canViewAllTasks)}
                            canEditReminder={canEditTaskReminder(task, currentEmployeeId, canViewAllTasks)}
                            canReassign={
                              canViewAllTasks ||
                              String(task.assigned_by_employee_id || "") === String(currentEmployeeId || "")
                            }
                            onReturn={(nextTask) => {
                              setReturnTarget(nextTask);
                              setReturnRemarks("");
                            }}
                          />
                        ))}
                      </div>
                    ) : null}

                    {taskView === "kanban" ? (
                      <div className={`grid gap-4 ${kanbanGroups.length > 3 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
                        {kanbanGroups.map((group) => (
                          <div key={group.key} className="rounded-[1.5rem] bg-[#f5f5f7] p-3">
                            <div className="mb-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`grid h-9 w-9 place-items-center rounded-2xl shadow-sm ${
                                    group.key === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-white text-black"
                                  }`}
                                >
                                  {group.key === "completed" ? <CheckCircle2 className="h-4 w-4" /> : <Columns3 className="h-4 w-4" />}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold">{group.label}</p>
                                  <p className="text-xs text-black/42">{group.rows.length} task(s)</p>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {group.rows.length ? (
                                group.rows.map((task) => {
                                  const smartAction = getSmartTaskAction(task);
                                  return (
                                    <article key={`${group.key}-${task.id}`} className="rounded-2xl bg-white p-3 ring-1 ring-black/6">
                                      <div className="flex flex-wrap gap-1.5">
                                        <Pill tone={priorityTone(task.priority)}>{labelize(task.priority)}</Pill>
                                        {task.status === "completed" ? <Pill tone="green">Completed</Pill> : null}
                                        {isTaskOverdue(task) ? <Pill tone="red">Overdue</Pill> : null}
                                      </div>
                                      <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5">{task.title}</h3>
                                      <p className="mt-2 text-xs text-black/48">Due {formatDateTime(task.due_at)}</p>
                                      <div className="mt-3 flex items-center justify-between gap-2">
                                        {smartAction ? (
                                          <a href={smartAction.href} className="text-xs font-semibold text-[#0071e3] hover:underline">
                                            {smartAction.label}
                                          </a>
                                        ) : (
                                          <span className="text-xs text-black/36">{getTaskAssigneeNames(task)}</span>
                                        )}
                                        {task.status !== "completed" && task.status !== "cancelled" ? (
                                          <button
                                            type="button"
                                            onClick={() => updateTaskStatus(task, "completed")}
                                            className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
                                          >
                                            Complete
                                          </button>
                                        ) : null}
                                      </div>
                                    </article>
                                  );
                                })
                              ) : (
                                <div className="rounded-2xl bg-white p-4 text-center text-sm text-black/42">
                                  Nothing here.
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {taskView === "workload" ? (
                      <div className="space-y-4">
                        <div className="overflow-x-auto rounded-[1.35rem] border border-black/8">
                          <div className="min-w-[920px]">
                            <div className="grid grid-cols-[1.6fr_repeat(6,minmax(92px,0.5fr))] bg-[#f5f5f7] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-black/40">
                              <span>Person</span>
                              <span>Pending</span>
                              <span>Completed</span>
                              <span>Overdue</span>
                              <span>Today</span>
                              <span>Critical</span>
                              <span>Total</span>
                            </div>
                            {workloadRows.length ? (
                              workloadRows.map((row) => (
                                <button
                                  type="button"
                                  key={row.key}
                                  onClick={() => setSelectedWorkloadUserKey(row.key)}
                                  className={`grid w-full grid-cols-[1.6fr_repeat(6,minmax(92px,0.5fr))] items-center border-t border-black/8 px-4 py-3 text-left text-sm transition ${
                                    selectedWorkloadUserKey === row.key
                                      ? "bg-sky-50"
                                      : "bg-white hover:bg-[#f8fafd]"
                                  }`}
                                >
                                  <span className="flex min-w-0 items-center gap-2 font-semibold">
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-black text-white">
                                      <Users className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate">{row.name}</span>
                                      <span className="mt-0.5 block text-xs font-medium text-black/42">
                                        {row.completionRate}% completion
                                      </span>
                                    </span>
                                  </span>
                                  <span className={row.pending ? "font-semibold text-sky-700" : "text-black/42"}>{row.pending}</span>
                                  <span className={row.completed ? "font-semibold text-emerald-700" : "text-black/42"}>{row.completed}</span>
                                  <span className={row.overdue ? "font-semibold text-rose-700" : "text-black/42"}>{row.overdue}</span>
                                  <span className={row.today ? "font-semibold text-amber-700" : "text-black/42"}>{row.today}</span>
                                  <span className={row.critical ? "font-semibold text-orange-700" : "text-black/42"}>{row.critical}</span>
                                  <span>{row.total}</span>
                                </button>
                              ))
                            ) : (
                              <div className="p-6 text-center text-sm text-black/42">No user-wise workload data for this scope.</div>
                            )}
                          </div>
                        </div>
                        {selectedWorkloadRow ? (
                          <div className="rounded-[1.35rem] border border-black/8 bg-white p-4 shadow-[0_18px_45px_-38px_rgba(0,0,0,0.38)]">
                            <div className="mb-4 grid gap-4 lg:grid-cols-[1.2fr_1.8fr] lg:items-end">
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/38">Selected User</p>
                                <h3 className="mt-1 truncate text-2xl font-semibold tracking-[-0.05em]">{selectedWorkloadRow.name}</h3>
                                <div className="mt-3">
                                  <div className="flex items-center justify-between text-xs font-semibold text-black/46">
                                    <span>Completion</span>
                                    <span>{selectedWorkloadRow.completionRate}%</span>
                                  </div>
                                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/8">
                                    <div
                                      className="h-full rounded-full bg-emerald-500"
                                      style={{ width: `${selectedWorkloadRow.completionRate}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                                {[
                                  { label: "Pending", value: selectedWorkloadRow.pending, tone: "text-sky-700 bg-sky-50" },
                                  { label: "Completed", value: selectedWorkloadRow.completed, tone: "text-emerald-700 bg-emerald-50" },
                                  { label: "Overdue", value: selectedWorkloadRow.overdue, tone: "text-rose-700 bg-rose-50" },
                                  { label: "Today", value: selectedWorkloadRow.today, tone: "text-amber-700 bg-amber-50" },
                                  { label: "Critical", value: selectedWorkloadRow.critical, tone: "text-orange-700 bg-orange-50" },
                                ].map((metric) => (
                                  <div key={metric.label} className={`rounded-2xl px-3 py-2 ${metric.tone}`}>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">{metric.label}</p>
                                    <p className="mt-1 text-xl font-semibold">{metric.value}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-5">
                              <WorkloadTaskBucket title="Pending" rows={selectedWorkloadRow.pendingTasks} tone="blue" emptyText="No pending task." />
                              <WorkloadTaskBucket title="Completed" rows={selectedWorkloadRow.completedTasks} tone="green" emptyText="No completed task." />
                              <WorkloadTaskBucket title="Overdue" rows={selectedWorkloadRow.overdueTasks} tone="red" emptyText="No overdue task." />
                              <WorkloadTaskBucket title="Today" rows={selectedWorkloadRow.todayTasks} tone="amber" emptyText="No task due today." />
                              <WorkloadTaskBucket title="Critical" rows={selectedWorkloadRow.criticalTasks} tone="red" emptyText="No critical task." />
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-[1.35rem] border border-dashed border-black/15 bg-[#f8fafd] p-6 text-center text-sm text-black/48">
                            Select any user row above to see that user&apos;s pending, completed, overdue, today, and critical tasks.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="grid min-h-[320px] place-items-center rounded-[1.5rem] bg-[#f5f5f7] text-center">
                    <div>
                      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                      <h3 className="mt-3 text-lg font-semibold">No active task found</h3>
                      <p className="mt-1 text-sm text-black/50">Create a task, change the filter, or switch scope.</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </section>
        </div>
      </div>

      {isTaskFormOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <form
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-[0_30px_80px_-36px_rgba(0,0,0,0.75)]"
            onSubmit={handleCreate}
          >
            <div className="flex items-center justify-between gap-3 border-b border-black/8 pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-black/40">
                  New Task
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.04em]">Create quick work</h2>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-black text-white">
                <Plus className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-black/70">Task title</span>
                <Input
                  value={form.title}
                  onChange={updateForm("title")}
                  placeholder="Reply to letter, prepare report, extend tender date..."
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-black/70">Description / instructions</span>
                <textarea
                  value={form.description}
                  onChange={updateForm("description")}
                  rows={3}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10"
                  placeholder="Add the expected action, file details, or remarks."
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <DateTimePicker
                  label="Due date and time"
                  value={form.due_at}
                  onChange={(value) => setFormValue("due_at", value)}
                />
                <DateTimePicker
                  label="Reminder date and time"
                  value={form.reminder_at}
                  onChange={(value) => setFormValue("reminder_at", value)}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-black/70">Reminder sound</span>
                  <select
                    value={form.reminder_sound}
                    onChange={updateForm("reminder_sound")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="soft_bell">Soft bell</option>
                    <option value="chime">Chime</option>
                    <option value="double_ping">Double ping</option>
                    <option value="digital_alarm">Digital alarm</option>
                    <option value="urgent_alert">Urgent alert</option>
                    <option value="voice_alert">Voice alert</option>
                    <option value="silent">Silent</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-black/70">Reminder repeats</span>
                  <select
                    value={form.reminder_frequency}
                    onChange={updateForm("reminder_frequency")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {reminderFrequencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-black/70">Repeat</span>
                  <select
                    value={form.repeat_rule}
                    onChange={updateForm("repeat_rule")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {taskRepeatOptions.map((option) => (
                      <option key={option.value || "none"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-black/70">Priority</span>
                <select
                  value={form.priority}
                  onChange={updateForm("priority")}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {canAssignTasks ? (
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-black/70">Assign to</span>
                  <select
                    value={form.assigned_to_employee_id}
                    onChange={updateForm("assigned_to_employee_id")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Myself</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {getEmployeeName(employee)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-slate-700">
                  <span className="block font-semibold text-slate-900">Assigned to you</span>
                  Officers can create personal tasks for themselves. Admin and Super Admin can assign tasks to others.
                </div>
              )}

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-black/70">Checklist items</span>
                <textarea
                  value={form.checklist_text}
                  onChange={updateForm("checklist_text")}
                  rows={3}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10"
                  placeholder="One item per line, for example: Draft reply, get approval, upload signed copy"
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-black/70">Link module</span>
                  <select
                    value={form.link_type}
                    onChange={updateLinkType}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {taskLinkTypes.map((option) => (
                      <option key={option.value || "none"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-black/70">Linked record</span>
                  <select
                    value={form.linked_record_id}
                    onChange={updateForm("linked_record_id")}
                    disabled={!form.link_type}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">
                      {form.link_type ? "Select record" : "Select module first"}
                    </option>
                    {currentLinkOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {selectedLink ? (
                <div className="rounded-2xl bg-[#f5f5f7] px-3 py-2 text-sm text-[#17324d]">
                  This task will open: <span className="font-semibold">{selectedLink.label}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 border-t border-black/8 pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                className="rounded-full"
                onClick={() => {
                  setIsTaskFormOpen(false);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]"
              >
                {saving ? "Saving..." : "Add Task"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {detailTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_80px_-36px_rgba(0,0,0,0.75)]">
            <div
              className={`px-5 py-4 text-white ${
                detailTarget.priority === "critical" || detailTarget.severity === "critical"
                  ? "bg-rose-600"
                  : detailTarget.priority === "high"
                    ? "bg-amber-600"
                    : detailTarget.origin_type === "system"
                      ? "bg-slate-900"
                      : "bg-[#7986cb]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                    {detailTarget.origin_type === "system" ? "System Event" : "Task Event"}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">
                    {detailTarget.title}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-white/86">
                    {formatCalendarTime(detailTarget.due_at)}
                  </p>
                </div>
                <button
                  type="button"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-xl text-white transition hover:bg-white/24"
                  onClick={() => setDetailTarget(null)}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-3 p-5">
              {detailTarget.description ? (
                <p className="rounded-2xl bg-[#f5f5f7] px-3 py-2 text-sm leading-6 text-black/62">
                  {detailTarget.description}
                </p>
              ) : null}
              <div className="grid gap-2 text-sm text-black/64 sm:grid-cols-2">
                <span className="rounded-2xl bg-[#f8fafd] px-3 py-2">
                  Due: <b>{formatDateTime(detailTarget.due_at)}</b>
                </span>
                <span className="rounded-2xl bg-[#f8fafd] px-3 py-2">
                  Reminder: <b>{formatDateTime(detailTarget.reminder_at)}</b>
                </span>
                <span className="rounded-2xl bg-[#f8fafd] px-3 py-2">
                  Assigned to: <b>{getTaskAssigneeNames(detailTarget)}</b>
                </span>
                <span className="rounded-2xl bg-[#f8fafd] px-3 py-2">
                  Status: <b>{labelize(detailTarget.status)}</b>
                </span>
              </div>
              {detailTarget.origin_type === "system" ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                  This event is generated automatically and cannot be edited by any user, including admin. Update the linked module if the source data needs correction.
                </div>
              ) : null}
              {detailTarget.linked_reference || detailTarget.linked_url ? (
                <div className="rounded-2xl bg-[#edf2fb] px-3 py-2 text-sm text-[#17324d]">
                  <p className="font-semibold">{detailTarget.linked_reference || "Linked record"}</p>
                  {detailTarget.linked_url ? (
                    <a
                      href={getSmartTaskAction(detailTarget)?.href || detailTarget.linked_url}
                      className="mt-1 inline-flex text-xs font-semibold text-[#0071e3] hover:underline"
                    >
                      {getSmartTaskAction(detailTarget)?.label || "Open Record"}
                    </a>
                  ) : null}
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setDetailTarget(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <form
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-[0_30px_80px_-36px_rgba(0,0,0,0.75)]"
            onSubmit={handleTaskEdit}
          >
            <div className="flex items-center justify-between gap-3 border-b border-black/8 pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-black/40">
                  Edit Task
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.04em]">
                  {editTarget.title}
                </h2>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-50 text-[#0071e3]">
                <Pencil className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-black/70">Task title</span>
                <Input
                  value={editForm.title}
                  onChange={updateEditForm("title")}
                  placeholder="Reply to letter, prepare report, extend tender date..."
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-black/70">Description / instructions</span>
                <textarea
                  value={editForm.description}
                  onChange={updateEditForm("description")}
                  rows={3}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10"
                  placeholder="Add the expected action, file details, or remarks."
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <DateTimePicker
                  label="Due date and time"
                  value={editForm.due_at}
                  allowClear
                  onChange={(value) => setEditFormValue("due_at", value)}
                />
                <DateTimePicker
                  label="Reminder date and time"
                  value={editForm.reminder_at}
                  allowClear
                  onChange={(value) => setEditFormValue("reminder_at", value)}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-black/70">Reminder sound</span>
                  <select
                    value={editForm.reminder_sound}
                    onChange={updateEditForm("reminder_sound")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="soft_bell">Soft bell</option>
                    <option value="chime">Chime</option>
                    <option value="double_ping">Double ping</option>
                    <option value="digital_alarm">Digital alarm</option>
                    <option value="urgent_alert">Urgent alert</option>
                    <option value="voice_alert">Voice alert</option>
                    <option value="silent">Silent</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-black/70">Reminder repeats</span>
                  <select
                    value={editForm.reminder_frequency}
                    onChange={updateEditForm("reminder_frequency")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {reminderFrequencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-black/70">Task repeat</span>
                  <select
                    value={editForm.repeat_rule}
                    onChange={updateEditForm("repeat_rule")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {taskRepeatOptions.map((option) => (
                      <option key={option.value || "none"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-black/70">Priority</span>
                <select
                  value={editForm.priority}
                  onChange={updateEditForm("priority")}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-black/70">Checklist items</span>
                <textarea
                  value={editForm.checklist_text}
                  onChange={updateEditForm("checklist_text")}
                  rows={3}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10"
                  placeholder="One item per line"
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-black/70">Link module</span>
                  <select
                    value={editForm.link_type}
                    onChange={updateEditLinkType}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {taskLinkTypes.map((option) => (
                      <option key={option.value || "none"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-black/70">Linked record</span>
                  <select
                    value={editForm.linked_record_id}
                    onChange={updateEditForm("linked_record_id")}
                    disabled={!editForm.link_type}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">
                      {editForm.link_type ? "Select record" : "Select module first"}
                    </option>
                    {currentEditLinkOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {selectedEditLink ? (
                <div className="rounded-2xl bg-[#f5f5f7] px-3 py-2 text-sm text-[#17324d]">
                  This task will open: <span className="font-semibold">{selectedEditLink.label}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 border-t border-black/8 pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                className="rounded-full"
                onClick={() => {
                  setEditTarget(null);
                  setEditForm(emptyForm);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {reminderTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <form
            className="w-full max-w-xl rounded-[2rem] bg-white p-5 shadow-[0_30px_80px_-36px_rgba(0,0,0,0.75)]"
            onSubmit={handleReminderEdit}
          >
            <div className="flex items-start justify-between gap-3 border-b border-black/8 pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-black/40">
                  Reminder
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.04em]">
                  {reminderTarget.title}
                </h2>
                <p className="mt-1 text-sm text-black/50">
                  Change reminder time and repeat frequency without changing the task itself.
                </p>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-50 text-[#0071e3]">
                <BellRing className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <DateTimePicker
                label="Reminder date and time"
                value={reminderForm.reminder_at}
                allowClear
                onChange={(value) =>
                  setReminderForm((current) => ({ ...current, reminder_at: value }))
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-black/70">Reminder sound</span>
                  <select
                    value={reminderForm.reminder_sound}
                    onChange={(event) =>
                      setReminderForm((current) => ({ ...current, reminder_sound: event.target.value }))
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="soft_bell">Soft bell</option>
                    <option value="chime">Chime</option>
                    <option value="double_ping">Double ping</option>
                    <option value="digital_alarm">Digital alarm</option>
                    <option value="urgent_alert">Urgent alert</option>
                    <option value="voice_alert">Voice alert</option>
                    <option value="silent">Silent</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-black/70">Reminder repeats</span>
                  <select
                    value={reminderForm.reminder_frequency}
                    onChange={(event) =>
                      setReminderForm((current) => ({ ...current, reminder_frequency: event.target.value }))
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {reminderFrequencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="rounded-2xl bg-[#f5f5f7] px-3 py-2 text-sm leading-6 text-black/56">
                Assigned and system tasks allow reminder changes only. Admin changes are saved on the same task record, so the assigned user sees the update automatically.
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 border-t border-black/8 pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                className="rounded-full"
                onClick={() => {
                  setReminderTarget(null);
                  setReminderForm({
                    reminder_at: "",
                    reminder_sound: "soft_bell",
                    reminder_frequency: "once",
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]"
              >
                {saving ? "Saving..." : "Save Reminder"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {returnTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <form
            onSubmit={submitReturn}
            className="w-full max-w-lg rounded-[2rem] bg-white p-5 shadow-[0_30px_80px_-36px_rgba(0,0,0,0.75)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-black/40">
              Return Task
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">{returnTarget.title}</h2>
            <p className="mt-2 text-sm leading-6 text-black/58">
              Use this when the task is wrongly assigned or needs correction from the assigner.
            </p>
            <textarea
              value={returnRemarks}
              onChange={(event) => setReturnRemarks(event.target.value)}
              rows={4}
              className="mt-4 w-full rounded-2xl border border-black/10 px-3 py-2 text-sm outline-none transition focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10"
              placeholder="Write clear remarks for the assigning authority..."
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  setReturnTarget(null);
                  setReturnRemarks("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-full bg-rose-600 text-white hover:bg-rose-700">
                Return with Remarks
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={() => setPopup((current) => ({ ...current, open: false }))}
      />
    </>
  );
}
