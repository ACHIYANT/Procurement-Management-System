import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  Route,
  Settings2,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSavedRecordUpdatePath } from "@/lib/approval-request-helper";
import { postProcurement, procurementRequest } from "@/lib/procurement-api";
import {
  PMS_ROLES,
  formatRoleLabel,
  getCurrentUserProfile,
  getCurrentUserRoles,
  hasAnyRole,
} from "@/lib/roles";

const approvalModules = [
  { value: "indents", label: "Indents" },
  { value: "procurementCases", label: "Procurement Cases" },
  { value: "tenders", label: "Tenders" },
  { value: "purchaseOrders", label: "Purchase Orders" },
  { value: "emd", label: "EMD" },
  { value: "pbg", label: "PBG" },
  { value: "committees", label: "Committees" },
  { value: "departmentFunds", label: "Department Funds" },
];

const approvalActions = [
  { value: "change_saved_record", label: "Change Saved Record" },
  { value: "financial_update", label: "Financial Update" },
  { value: "document_replacement", label: "Document Replacement" },
  { value: "workflow_override", label: "Workflow Override" },
];

const approverRoles = [
  PMS_ROLES.APPROVER,
  PMS_ROLES.FINANCE_OFFICER,
  PMS_ROLES.ADMIN,
  PMS_ROLES.SUPER_ADMIN,
  PMS_ROLES.INDENT_INITIATOR,
  PMS_ROLES.PROCUREMENT_OFFICER,
];

const moduleLabelMap = Object.fromEntries(
  approvalModules.map((module) => [module.value, module.label]),
);
const actionLabelMap = Object.fromEntries(
  approvalActions.map((action) => [action.value, action.label]),
);

const emptyLevel = (levelNo = 1) => ({
  level_no: levelNo,
  level_name: `Level ${levelNo}`,
  approver_type: "role",
  approver_role: PMS_ROLES.APPROVER,
  min_required_approvals: 1,
});

const label = (value) =>
  String(value || "NA")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const resolveCurrentStep = (request) =>
  (Array.isArray(request?.steps) ? request.steps : []).find(
    (step) => step.status === "pending",
  );

const statusTone = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "pending") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (normalized === "approved") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (normalized === "rejected") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (normalized === "applied") return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
};

const getApprovedEditHref = (request) => {
  if (request?.status !== "approved") return "";
  return getSavedRecordUpdatePath({
    moduleKey: request.module_key,
    entityType: request.entity_type,
    entityId: request.entity_id,
    approvalRequestId: request.id,
  });
};

function RequestCard({ request, onDecision, compact = false }) {
  const step = resolveCurrentStep(request);
  const editHref = getApprovedEditHref(request);

  return (
    <article className="rounded-2xl bg-white p-4 shadow-[0_14px_36px_-30px_rgba(0,0,0,0.35)] ring-1 ring-black/8">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ring-1 ${statusTone(request.status)}`}
            >
              {label(request.status)}
            </span>
            <span className="text-xs font-medium text-black/45">
              #{request.id}
            </span>
          </div>
          <h3 className="mt-2 text-base font-semibold leading-snug text-[#1d1d1f]">
            {request.request_title}
          </h3>
          <p className="mt-1 text-xs font-medium text-black/50">
            {moduleLabelMap[request.module_key] || label(request.module_key)} ·{" "}
            {actionLabelMap[request.action_key] || label(request.action_key)} ·{" "}
            {request.entity_type} #{request.entity_id}
          </p>
          {!compact && request.request_reason ? (
            <p className="mt-3 rounded-xl bg-[#f5f5f7] px-3 py-2 text-sm leading-5 text-black/62">
              {request.request_reason}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-black/48">
            Requested by {request.requested_by_name || "NA"} ·{" "}
            {step?.level_name || label(request.status)}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {request.status === "pending" ? (
            <>
              <Button
                type="button"
                size="sm"
                className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => onDecision(request, "approve")}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full text-rose-700"
                onClick={() => onDecision(request, "reject")}
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </>
          ) : null}
          {editHref ? (
            <Button asChild type="button" size="sm" variant="outline" className="rounded-full">
              <Link to={editHref}>
                <ArrowUpRight className="h-4 w-4" />
                Update Record
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function ApprovalCenter({ requestsOnly = false }) {
  const [roles] = useState(() => getCurrentUserRoles());
  const [profile] = useState(() => getCurrentUserProfile());
  const [workflows, setWorkflows] = useState([]);
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [workflowForm, setWorkflowForm] = useState({
    module_key: "purchaseOrders",
    action_key: "change_saved_record",
    workflow_name: "Saved record change approval",
    description: "",
    is_active: true,
    levels: [emptyLevel(1)],
  });
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });

  const canManageWorkflows = hasAnyRole(roles, [
    PMS_ROLES.ADMIN,
    PMS_ROLES.SUPER_ADMIN,
  ]);

  const actorPayload = useMemo(
    () => ({
      actor_employee_id: profile?.employee_id || profile?.id || null,
      actor_name:
        profile?.employee_name ||
        profile?.fullname ||
        profile?.fullName ||
        localStorage.getItem("fullname") ||
        "",
      actor_roles: roles,
    }),
    [profile, roles],
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [nextWorkflows, nextRequests, nextEmployees] = await Promise.all([
        procurementRequest("/approvals/workflows"),
        procurementRequest("/approvals/requests?activeOnly=true"),
        procurementRequest("/procurement-employees"),
      ]);
      setWorkflows(Array.isArray(nextWorkflows) ? nextWorkflows : []);
      setRequests(Array.isArray(nextRequests) ? nextRequests : []);
      setEmployees(Array.isArray(nextEmployees) ? nextEmployees : []);
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to load approval center.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const pendingRequests = requests.filter((request) => request.status === "pending");
  const approvedRequests = requests.filter((request) => request.status === "approved");

  const setWorkflowField = (field, value) => {
    setWorkflowForm((current) => ({ ...current, [field]: value }));
  };

  const setLevelField = (index, field, value) => {
    setWorkflowForm((current) => ({
      ...current,
      levels: current.levels.map((level, levelIndex) =>
        levelIndex === index ? { ...level, [field]: value } : level,
      ),
    }));
  };

  const addLevel = () => {
    setWorkflowForm((current) => ({
      ...current,
      levels: [...current.levels, emptyLevel(current.levels.length + 1)],
    }));
  };

  const removeLevel = (index) => {
    setWorkflowForm((current) => ({
      ...current,
      levels: current.levels
        .filter((_, levelIndex) => levelIndex !== index)
        .map((level, levelIndex) => ({
          ...level,
          level_no: levelIndex + 1,
          level_name: level.level_name || `Level ${levelIndex + 1}`,
        })),
    }));
  };

  const editWorkflow = (workflow) => {
    setSelectedWorkflowId(workflow.id);
    setWorkflowForm({
      module_key: workflow.module_key || "purchaseOrders",
      action_key: workflow.action_key || "change_saved_record",
      workflow_name: workflow.workflow_name || "",
      description: workflow.description || "",
      is_active: workflow.is_active !== false,
      levels:
        Array.isArray(workflow.levels) && workflow.levels.length
          ? workflow.levels.map((level) => ({
              level_no: level.level_no,
              level_name: level.level_name,
              approver_type: level.approver_type || "role",
              approver_role: level.approver_role || PMS_ROLES.APPROVER,
              approver_employee_id: level.approver_employee_id || "",
              min_required_approvals: level.min_required_approvals || 1,
            }))
          : [emptyLevel(1)],
    });
  };

  const resetWorkflowForm = () => {
    setSelectedWorkflowId("");
    setWorkflowForm({
      module_key: "purchaseOrders",
      action_key: "change_saved_record",
      workflow_name: "Saved record change approval",
      description: "",
      is_active: true,
      levels: [emptyLevel(1)],
    });
  };

  const saveWorkflow = async (event) => {
    event.preventDefault();
    setSavingWorkflow(true);
    try {
      const payload = {
        ...workflowForm,
        ...actorPayload,
        levels: workflowForm.levels.map((level, index) => ({
          ...level,
          level_no: index + 1,
          min_required_approvals: Number(level.min_required_approvals || 1),
          approver_employee_id:
            level.approver_type === "employee"
              ? level.approver_employee_id
              : null,
          approver_role:
            level.approver_type === "role" ? level.approver_role : null,
        })),
      };

      if (selectedWorkflowId) {
        await procurementRequest(`/approvals/workflows/${selectedWorkflowId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await postProcurement("/approvals/workflows", payload);
      }

      setPopup({
        open: true,
        type: "success",
        message: "Approval route saved.",
      });
      resetWorkflowForm();
      await loadData();
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to save approval route.",
      });
    } finally {
      setSavingWorkflow(false);
    }
  };

  const decideRequest = async (request, decision) => {
    try {
      await postProcurement(`/approvals/requests/${request.id}/${decision}`, {
        ...actorPayload,
        remarks:
          decision === "approve"
            ? "Approved from approval requests."
            : "Rejected from approval requests.",
      });
      setPopup({
        open: true,
        type: "success",
        message:
          decision === "approve" ? "Request approved." : "Request rejected.",
      });
      await loadData();
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to update approval request.",
      });
    }
  };

  const requestQueue = (
    <section className="rounded-[28px] bg-[#f5f5f7] p-4 ring-1 ring-black/8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-black/42">
            Active Requests
          </p>
          <h2 className="mt-2 text-[1.55rem] font-semibold tracking-[-0.035em]">
            Approval requests
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-amber-700 ring-1 ring-amber-100">
            Pending {pendingRequests.length}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
            Approved {approvedRequests.length}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {requests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            onDecision={decideRequest}
            compact={!requestsOnly}
          />
        ))}
        {!requests.length ? (
          <div className="rounded-2xl border border-dashed border-black/12 bg-white px-4 py-8 text-sm text-black/55">
            {loading ? "Loading approval requests..." : "No active approval request is pending."}
          </div>
        ) : null}
      </div>
    </section>
  );

  if (requestsOnly) {
    return (
      <div className="min-h-full bg-transparent px-4 py-7 text-[#1d1d1f]">
        <div className="mx-auto max-w-[1280px] space-y-5">
          <section className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
            <div className="px-6 py-7 md:px-8">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-white/72">
                <ClipboardCheck className="h-4 w-4" />
                Approval Desk
              </p>
              <h1 className="mt-3 text-[2rem] font-semibold tracking-[-0.04em] md:text-[2.45rem]">
                Review, approve, or reject requests
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/68">
                Approved saved-record change requests unlock the matching record
                for update until the update is applied.
              </p>
            </div>
          </section>

          {requestQueue}
        </div>

        <PopupMessage
          open={popup.open}
          type={popup.type}
          message={popup.message}
          onClose={() => setPopup({ open: false, type: "info", message: "" })}
        />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-transparent px-4 py-7 text-[#1d1d1f]">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
          <div className="px-6 py-7 md:px-8">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-white/72">
              <Route className="h-4 w-4" />
              Approval Engine
            </p>
            <h1 className="mt-3 max-w-5xl text-[2rem] font-semibold tracking-[-0.04em] md:text-[2.45rem]">
              Approval routes and saved-record controls
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-white/68">
              Admin users configure routes here. Approvers should use Approval
              Requests from the sidebar for daily decisions.
            </p>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_28rem]">
          <div className="space-y-5">
            {canManageWorkflows ? (
              <form
                className="rounded-[28px] bg-white p-5 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8"
                onSubmit={saveWorkflow}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-black/42">
                      Workflow Setup
                    </p>
                    <h2 className="mt-2 text-[1.55rem] font-semibold tracking-[-0.035em]">
                      {selectedWorkflowId ? "Edit approval route" : "Create approval route"}
                    </h2>
                  </div>
                  {selectedWorkflowId ? (
                    <Button type="button" variant="outline" onClick={resetWorkflowForm}>
                      New
                    </Button>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                      Module
                    </span>
                    <select
                      className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
                      value={workflowForm.module_key}
                      onChange={(event) => setWorkflowField("module_key", event.target.value)}
                    >
                      {approvalModules.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                      Action
                    </span>
                    <select
                      className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
                      value={workflowForm.action_key}
                      onChange={(event) => setWorkflowField("action_key", event.target.value)}
                    >
                      {approvalActions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                      Workflow Name
                    </span>
                    <Input
                      value={workflowForm.workflow_name}
                      onChange={(event) => setWorkflowField("workflow_name", event.target.value)}
                      placeholder="Saved record change approval"
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                      Description
                    </span>
                    <textarea
                      className="min-h-20 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#0071e3]"
                      value={workflowForm.description}
                      onChange={(event) => setWorkflowField("description", event.target.value)}
                    />
                  </label>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Approval Levels</p>
                    <Button type="button" variant="outline" size="sm" onClick={addLevel}>
                      <Plus className="h-4 w-4" />
                      Add Level
                    </Button>
                  </div>

                  {workflowForm.levels.map((level, index) => (
                    <div
                      key={`${level.level_no}-${index}`}
                      className="rounded-2xl bg-[#f5f5f7] p-3 ring-1 ring-black/6"
                    >
                      <div className="grid gap-3 md:grid-cols-[1fr_10rem_1fr_8rem_auto]">
                        <Input
                          value={level.level_name}
                          onChange={(event) => setLevelField(index, "level_name", event.target.value)}
                          placeholder={`Level ${index + 1}`}
                        />
                        <select
                          className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm"
                          value={level.approver_type}
                          onChange={(event) => setLevelField(index, "approver_type", event.target.value)}
                        >
                          <option value="role">Role</option>
                          <option value="employee">Employee</option>
                        </select>
                        {level.approver_type === "employee" ? (
                          <select
                            className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm"
                            value={level.approver_employee_id || ""}
                            onChange={(event) =>
                              setLevelField(index, "approver_employee_id", event.target.value)
                            }
                          >
                            <option value="">Select employee</option>
                            {employees.map((employee) => (
                              <option key={employee.id} value={employee.id}>
                                {employee.employee_name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm"
                            value={level.approver_role || PMS_ROLES.APPROVER}
                            onChange={(event) => setLevelField(index, "approver_role", event.target.value)}
                          >
                            {approverRoles.map((role) => (
                              <option key={role} value={role}>
                                {formatRoleLabel(role)}
                              </option>
                            ))}
                          </select>
                        )}
                        <Input
                          type="number"
                          min="1"
                          value={level.min_required_approvals}
                          onChange={(event) =>
                            setLevelField(index, "min_required_approvals", event.target.value)
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={workflowForm.levels.length === 1}
                          onClick={() => removeLevel(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  className="mt-5 rounded-full bg-[#0071e3] px-6 text-white hover:bg-[#0066cc]"
                  disabled={savingWorkflow}
                >
                  {savingWorkflow ? "Saving..." : "Save Approval Route"}
                </Button>
              </form>
            ) : (
              <div className="rounded-[28px] bg-white p-6 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
                <Settings2 className="h-5 w-5 text-black/48" />
                <h2 className="mt-3 text-xl font-semibold">Workflow setup is admin-only</h2>
                <p className="mt-1 text-sm text-black/56">
                  Use Approval Requests from the sidebar to approve or reject
                  pending requests.
                </p>
              </div>
            )}

            <section className="rounded-[28px] bg-white p-5 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-black/42">
                Configured Routes
              </p>
              <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-black/8">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#f5f5f7] text-[11px] uppercase tracking-[0.22em] text-black/42">
                    <tr>
                      <th className="px-4 py-3">Workflow</th>
                      <th className="px-4 py-3">Module</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Levels</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/6">
                    {workflows.map((workflow) => (
                      <tr key={workflow.id} className="bg-white">
                        <td className="px-4 py-3 font-semibold">{workflow.workflow_name}</td>
                        <td className="px-4 py-3">{moduleLabelMap[workflow.module_key] || label(workflow.module_key)}</td>
                        <td className="px-4 py-3">{actionLabelMap[workflow.action_key] || label(workflow.action_key)}</td>
                        <td className="px-4 py-3">
                          {(workflow.levels || []).map((level) => level.level_name).join(" -> ") || "NA"}
                        </td>
                        <td className="px-4 py-3">{workflow.is_active ? "Active" : "Inactive"}</td>
                        <td className="px-4 py-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!canManageWorkflows}
                            onClick={() => editWorkflow(workflow)}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!workflows.length ? (
                      <tr>
                        <td className="px-4 py-6 text-center text-black/52" colSpan={6}>
                          No approval workflow configured yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {requestQueue}
        </section>
      </div>

      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={() => setPopup({ open: false, type: "info", message: "" })}
      />
    </div>
  );
}
