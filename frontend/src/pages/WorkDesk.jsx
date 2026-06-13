import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListChecks,
  Plus,
  RefreshCw,
  RotateCcw,
  UserRound,
} from "lucide-react";

import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postProcurement, procurementRequest } from "@/lib/procurement-api";
import { formatRoleLabel, getCurrentUserProfile, getCurrentUserRoles } from "@/lib/roles";

const viewOptions = [
  { value: "list", label: "List" },
  { value: "month", label: "Month" },
  { value: "agenda", label: "Agenda Rows" },
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const severityOptions = [
  { value: "normal", label: "Normal" },
  { value: "important", label: "Important" },
  { value: "urgent", label: "Urgent" },
  { value: "critical", label: "Critical" },
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
  due_date: "",
  due_time: "",
  reminder_date: "",
  reminder_time: "",
  priority: "medium",
  severity: "normal",
  assigned_to_employee_id: "",
  link_type: "",
  linked_record_id: "",
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

const combineDateAndTime = (date, time, fallbackTime = "17:00") => {
  if (!date) return null;
  return `${date}T${time || fallbackTime}`;
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

const getTaskAssigneeNames = (task) => {
  const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
  const names = assignees
    .map((assignee) => assignee.assigned_to_name || assignee.assigned_to_employee?.employee_name)
    .filter(Boolean);
  return names.length ? names.join(", ") : "Self / Unassigned";
};

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

const isTaskOverdue = (task) => {
  if (!task?.due_at || ["completed", "cancelled"].includes(task.status)) return false;
  return new Date(task.due_at).getTime() < Date.now();
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

function TaskCard({ task, onStatus, onReturn }) {
  const overdue = isTaskOverdue(task);

  return (
    <article className="rounded-[1.7rem] border border-black/8 bg-white p-4 shadow-[0_18px_45px_-36px_rgba(0,0,0,0.55)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={statusTone(task.status)}>{labelize(task.status)}</Pill>
            <Pill tone={priorityTone(task.priority)}>{labelize(task.priority)} Priority</Pill>
            {overdue ? <Pill tone="red">Overdue</Pill> : null}
            {task.origin_type === "system" ? <Pill tone="black">System Generated</Pill> : null}
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
            <span className="inline-flex items-center gap-2">
              <BellRing className="h-4 w-4 text-black/36" />
              Reminder {formatDateTime(task.reminder_at)}
            </span>
            <span className="inline-flex items-center gap-2">
              <UserRound className="h-4 w-4 text-black/36" />
              Assigned to {getTaskAssigneeNames(task)}
            </span>
            <span className="inline-flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-black/36" />
              By {task.assigned_by_name || task.origin_label || "Self"}
            </span>
          </div>
          {task.linked_reference || task.linked_url ? (
            <div className="mt-3 rounded-2xl bg-[#f5f5f7] px-3 py-2 text-sm text-[#17324d]">
              {task.linked_url ? (
                <a href={task.linked_url} className="font-semibold hover:underline">
                  {task.linked_reference || task.linked_url}
                </a>
              ) : (
                <span className="font-semibold">{task.linked_reference}</span>
              )}
            </div>
          ) : null}
          {task.return_remarks ? (
            <div className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-700">
              Returned remarks: {task.return_remarks}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {task.status === "open" || task.status === "returned" ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => onStatus(task, "in_progress")}
            >
              Start
            </Button>
          ) : null}
          {task.status !== "completed" && task.status !== "cancelled" ? (
            <>
              <Button
                type="button"
                className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => onStatus(task, "completed")}
              >
                Complete
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full text-rose-700"
                onClick={() => onReturn(task)}
              >
                Return
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

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
  const [viewMode, setViewMode] = useState("list");
  const [scope, setScope] = useState(() => {
    const currentProfile = getCurrentUserProfile();
    return currentProfile?.employee_id || currentProfile?.id ? "mine" : "all";
  });
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [form, setForm] = useState(emptyForm);
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnRemarks, setReturnRemarks] = useState("");
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });

  const actorPayload = useMemo(
    () => ({
      actor_employee_id: profile?.employee_id || profile?.id || null,
      actor_name:
        profile?.employee_name ||
        profile?.fullname ||
        localStorage.getItem("fullname") ||
        "Procurement User",
      actor_roles: roles,
    }),
    [profile, roles],
  );

  const currentEmployeeId = actorPayload.actor_employee_id;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ status: "active", limit: "500" });
      if (scope === "mine" && currentEmployeeId) {
        params.set("employee_id", currentEmployeeId);
      }

      const [nextTasks, nextEmployees, nextIndents, nextCases, nextTenders] = await Promise.all([
        procurementRequest(`/work-tasks?${params.toString()}`),
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
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to load tasks.",
      });
    } finally {
      setLoading(false);
    }
  }, [currentEmployeeId, scope]);

  useEffect(() => {
    const timer = setTimeout(() => loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const tasksByDay = useMemo(() => {
    const grouped = {};
    tasks.forEach((task) => {
      const key = toDateKey(task.due_at);
      grouped[key] = grouped[key] || [];
      grouped[key].push(task);
    });
    return grouped;
  }, [tasks]);

  const monthDays = useMemo(() => buildMonthDays(calendarDate), [calendarDate]);

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

  const updateForm = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const updateLinkType = (event) => {
    setForm((current) => ({
      ...current,
      link_type: event.target.value,
      linked_record_id: "",
    }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setPopup({ open: true, type: "error", message: "Task title is required." });
      return;
    }
    if (form.link_type && !selectedLink) {
      setPopup({ open: true, type: "error", message: "Please select the linked record." });
      return;
    }

    setSaving(true);
    try {
      const assignedEmployee = employees.find(
        (employee) => String(employee.id) === String(form.assigned_to_employee_id),
      );
      const assignedToSelf =
        !form.assigned_to_employee_id ||
        String(form.assigned_to_employee_id) === String(currentEmployeeId || "");

      await postProcurement("/work-tasks", {
        ...form,
        ...actorPayload,
        origin_type: assignedToSelf ? "self" : "manual_assignment",
        origin_label: assignedToSelf ? "Self Created" : "Assigned by Higher Authority",
        assigned_to_employee_id: form.assigned_to_employee_id || currentEmployeeId,
        assigned_to_name: assignedEmployee ? getEmployeeName(assignedEmployee) : actorPayload.actor_name,
        due_at: combineDateAndTime(form.due_date, form.due_time),
        reminder_at: combineDateAndTime(form.reminder_date, form.reminder_time, "09:00"),
        module_key: selectedLink?.module_key || null,
        entity_type: selectedLink?.entity_type || null,
        entity_id: selectedLink?.entity_id || null,
        linked_reference: selectedLink?.linked_reference || null,
        linked_url: selectedLink?.linked_url || null,
      });
      setForm(emptyForm);
      setPopup({ open: true, type: "success", message: "Task created successfully." });
      await loadData();
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to create task." });
    } finally {
      setSaving(false);
    }
  };

  const updateTaskStatus = async (task, status) => {
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

  const submitReturn = async (event) => {
    event.preventDefault();
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

  const moveMonth = (offset) => {
    setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <>
      <div className="min-h-full bg-[#f5f5f7] px-4 py-7 text-[#1d1d1f]">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="overflow-hidden rounded-[2rem] bg-[#121316] text-white shadow-[0_34px_80px_-48px_rgba(0,0,0,0.75)]">
            <div className="grid gap-6 p-6 lg:grid-cols-[1.35fr_0.65fr] lg:p-8">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-white/50">
                  My Work
                </p>
                <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.06em] md:text-5xl">
                  Tasks, reminders, and procurement deadlines in one place.
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-white/68 md:text-base">
                  See who assigned the task, whether it is system generated, and return wrongly assigned work with clear remarks.
                </p>
              </div>
              <div className="rounded-[1.6rem] bg-white/8 p-4 ring-1 ring-white/12">
                <p className="text-xs uppercase tracking-[0.28em] text-white/48">Signed in as</p>
                <p className="mt-2 text-xl font-semibold">{actorPayload.actor_name}</p>
                <p className="mt-1 text-sm text-white/56">
                  {roles.length ? roles.map(formatRoleLabel).join(", ") : "Role loading"}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <p className="text-white/46">Today</p>
                    <p className="mt-1 text-2xl font-semibold">{summary.today}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <p className="text-white/46">Critical</p>
                    <p className="mt-1 text-2xl font-semibold">{summary.critical}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-5">
            {[
              { label: "Open", value: summary.open, icon: ListChecks, tone: "bg-sky-50 text-sky-700" },
              { label: "Overdue", value: summary.overdue, icon: AlertTriangle, tone: "bg-rose-50 text-rose-700" },
              { label: "Due Today", value: summary.today, icon: Clock3, tone: "bg-amber-50 text-amber-700" },
              { label: "Returned", value: summary.returned, icon: RotateCcw, tone: "bg-orange-50 text-orange-700" },
              { label: "All Active", value: tasks.length, icon: CalendarDays, tone: "bg-emerald-50 text-emerald-700" },
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

          <section className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
            <form
              className="rounded-[2rem] bg-white p-5 ring-1 ring-black/8"
              onSubmit={handleCreate}
            >
              <div className="flex items-center justify-between gap-3">
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
                  <Input value={form.title} onChange={updateForm("title")} placeholder="Reply to letter, prepare report, extend tender date..." />
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
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-black/70">Due date</span>
                    <Input type="date" value={form.due_date} onChange={updateForm("due_date")} />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-black/70">Due time</span>
                    <Input type="time" value={form.due_time} onChange={updateForm("due_time")} disabled={!form.due_date} />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-black/70">Reminder date</span>
                    <Input type="date" value={form.reminder_date} onChange={updateForm("reminder_date")} />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-black/70">Reminder time</span>
                    <Input type="time" value={form.reminder_time} onChange={updateForm("reminder_time")} disabled={!form.reminder_date} />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
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
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-black/70">Severity color</span>
                    <select
                      value={form.severity}
                      onChange={updateForm("severity")}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {severityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

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

              <Button
                type="submit"
                disabled={saving}
                className="mt-5 w-full rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]"
              >
                {saving ? "Saving..." : "Add Task"}
              </Button>
            </form>

            <section className="rounded-[2rem] bg-white ring-1 ring-black/8">
              <div className="flex flex-col gap-4 border-b border-black/8 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-black/40">
                    Work Queue
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-[-0.04em]">Tasks and calendar</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={scope}
                    onChange={(event) => setScope(event.target.value)}
                    className="h-10 rounded-full border border-black/10 bg-white px-3 text-sm"
                  >
                    <option value="mine">My tasks</option>
                    <option value="all">All active tasks</option>
                  </select>
                  <div className="rounded-full bg-[#f5f5f7] p-1">
                    {viewOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setViewMode(option.value)}
                        className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                          viewMode === option.value ? "bg-black text-white" : "text-black/58"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <Button type="button" variant="outline" className="rounded-full" onClick={loadData}>
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="p-5">
                {loading ? (
                  <div className="grid min-h-[320px] place-items-center text-sm text-black/50">
                    Loading work desk...
                  </div>
                ) : tasks.length ? (
                  <>
                    {viewMode === "list" ? (
                      <div className="space-y-3">
                        {tasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onStatus={updateTaskStatus}
                            onReturn={(nextTask) => {
                              setReturnTarget(nextTask);
                              setReturnRemarks("");
                            }}
                          />
                        ))}
                      </div>
                    ) : null}

                    {viewMode === "month" ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => moveMonth(-1)}>
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          <h3 className="text-lg font-semibold">{monthLabel(calendarDate)}</h3>
                          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => moveMonth(1)}>
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-7 overflow-hidden rounded-[1.35rem] border border-black/8">
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                            <div key={day} className="bg-[#f5f5f7] px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-black/40">
                              {day}
                            </div>
                          ))}
                          {monthDays.map((day) => {
                            const dayTasks = tasksByDay[day.key] || [];
                            return (
                              <div
                                key={day.key}
                                className={`min-h-[132px] border-t border-black/8 p-2 ${
                                  day.isCurrentMonth ? "bg-white" : "bg-[#fafafa] text-black/35"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`grid h-7 w-7 place-items-center rounded-full text-sm font-semibold ${
                                      day.isToday ? "bg-[#0071e3] text-white" : ""
                                    }`}
                                  >
                                    {day.date.getDate()}
                                  </span>
                                  {dayTasks.length ? <span className="text-xs text-black/36">{dayTasks.length}</span> : null}
                                </div>
                                <div className="mt-2 space-y-1.5">
                                  {dayTasks.slice(0, 3).map((task) => (
                                    <button
                                      key={task.id}
                                      type="button"
                                      onClick={() => setViewMode("list")}
                                      className={`block w-full truncate rounded-xl px-2 py-1 text-left text-xs font-semibold ${
                                        task.priority === "critical"
                                          ? "bg-rose-50 text-rose-700"
                                          : task.priority === "high"
                                            ? "bg-amber-50 text-amber-700"
                                            : "bg-sky-50 text-sky-700"
                                      }`}
                                      title={task.title}
                                    >
                                      {task.title}
                                    </button>
                                  ))}
                                  {dayTasks.length > 3 ? (
                                    <span className="block text-xs font-semibold text-black/42">
                                      +{dayTasks.length - 3} more
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {viewMode === "agenda" ? (
                      <div className="overflow-hidden rounded-[1.35rem] border border-black/8">
                        {agendaGroups.map((group) => (
                          <div key={group.key} className="grid gap-0 border-b border-black/8 last:border-b-0 md:grid-cols-[180px_1fr]">
                            <div className="bg-[#f5f5f7] p-4 text-sm font-semibold text-black/62">
                              {group.label}
                            </div>
                            <div className="divide-y divide-black/8">
                              {group.rows.map((task) => (
                                <div key={task.id} className="flex flex-col gap-2 p-4 lg:flex-row lg:items-center lg:justify-between">
                                  <div>
                                    <p className="font-semibold">{task.title}</p>
                                    <p className="mt-1 text-sm text-black/50">
                                      {labelize(task.status)} by {task.assigned_by_name || task.origin_label || "Self"} to {getTaskAssigneeNames(task)}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Pill tone={priorityTone(task.priority)}>{labelize(task.priority)}</Pill>
                                    <Pill tone={statusTone(task.status)}>{labelize(task.status)}</Pill>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="grid min-h-[320px] place-items-center rounded-[1.5rem] bg-[#f5f5f7] text-center">
                    <div>
                      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                      <h3 className="mt-3 text-lg font-semibold">No active task found</h3>
                      <p className="mt-1 text-sm text-black/50">Create a task or switch to all active tasks.</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </section>
        </div>
      </div>

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
