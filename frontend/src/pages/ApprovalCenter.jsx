import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Plus, Route, XCircle } from "lucide-react";

import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postProcurement, procurementRequest } from "@/lib/procurement-api";
import { PMS_ROLES, formatRoleLabel, getCurrentUserProfile, getCurrentUserRoles } from "@/lib/roles";

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

export default function ApprovalCenter() {
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
  const [requestForm, setRequestForm] = useState({
    module_key: "purchaseOrders",
    action_key: "change_saved_record",
    entity_type: "purchase_order",
    entity_id: "",
    request_title: "",
    request_reason: "",
    proposed_payload: "{}",
  });
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });

  const actorPayload = useMemo(
    () => ({
      actor_employee_id: profile?.employee_id || profile?.id || null,
      actor_name: profile?.employee_name || profile?.fullname || localStorage.getItem("fullname") || "",
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
      levels: Array.isArray(workflow.levels) && workflow.levels.length
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
            level.approver_type === "employee" ? level.approver_employee_id : null,
          approver_role: level.approver_type === "role" ? level.approver_role : null,
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
        message: "Approval workflow saved.",
      });
      resetWorkflowForm();
      await loadData();
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to save approval workflow.",
      });
    } finally {
      setSavingWorkflow(false);
    }
  };

  const createSampleRequest = async (event) => {
    event.preventDefault();
    try {
      let proposedPayload = {};
      try {
        proposedPayload = JSON.parse(requestForm.proposed_payload || "{}");
      } catch {
        setPopup({
          open: true,
          type: "error",
          message: "Proposed payload must be valid JSON.",
        });
        return;
      }

      await postProcurement("/approvals/requests", {
        ...requestForm,
        ...actorPayload,
        proposed_payload: proposedPayload,
      });
      setPopup({
        open: true,
        type: "success",
        message: "Approval request created.",
      });
      setRequestForm((current) => ({
        ...current,
        entity_id: "",
        request_title: "",
        request_reason: "",
        proposed_payload: "{}",
      }));
      await loadData();
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to create approval request.",
      });
    }
  };

  const decideRequest = async (request, decision) => {
    try {
      await postProcurement(`/approvals/requests/${request.id}/${decision}`, {
        ...actorPayload,
        remarks: decision === "approve" ? "Approved from approval center." : "Rejected from approval center.",
      });
      setPopup({
        open: true,
        type: "success",
        message: decision === "approve" ? "Request approved." : "Request rejected.",
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

  return (
    <div className="min-h-full bg-transparent px-4 py-7 text-[#1d1d1f]">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
          <div className="border-b border-white/10 px-6 py-4">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-white/72">
              <Route className="h-4 w-4" />
              Dynamic approval control
            </p>
          </div>
          <div className="space-y-4 px-6 py-7 md:px-8 md:py-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">
              Approval Engine
            </p>
            <h1 className="max-w-5xl text-3xl font-semibold tracking-[-0.035em] md:text-[2.7rem] md:leading-[1.04]">
              Configure levels once, route every change safely
            </h1>
            <p className="max-w-4xl text-sm leading-6 text-white/70 md:text-[15px]">
              Define module-wise approval levels for saved-record changes,
              financial updates, document replacements, and workflow overrides.
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
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
                  placeholder="Explain when this approval route should be used."
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
                  className="rounded-[22px] bg-[#f5f5f7] p-3 ring-1 ring-black/6"
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
                      placeholder="Required"
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

          <div className="space-y-4">
            <section className="rounded-[28px] bg-white p-5 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-black/42">
                Active Requests
              </p>
              <h2 className="mt-2 text-[1.55rem] font-semibold tracking-[-0.035em]">
                Pending approvals
              </h2>
              <div className="mt-4 space-y-2">
                {requests.map((request) => {
                  const step = resolveCurrentStep(request);
                  return (
                    <div key={request.id} className="rounded-[20px] bg-[#f5f5f7] p-3 ring-1 ring-black/6">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold">{request.request_title}</p>
                          <p className="mt-1 text-xs text-black/52">
                            {label(request.module_key)} • {label(request.action_key)} •{" "}
                            {request.entity_type} #{request.entity_id}
                          </p>
                          <p className="mt-2 text-xs text-black/56">
                            Current level: {step?.level_name || label(request.status)}
                          </p>
                        </div>
                        {request.status === "pending" ? (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                              onClick={() => decideRequest(request, "approve")}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-full text-rose-700"
                              onClick={() => decideRequest(request, "reject")}
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/52">
                            {request.status}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!requests.length ? (
                  <div className="rounded-[20px] border border-dashed border-black/12 bg-[#f5f5f7] px-4 py-8 text-sm text-black/55">
                    {loading ? "Loading approval requests..." : "No active approval request is pending."}
                  </div>
                ) : null}
              </div>
            </section>

            <form
              className="rounded-[28px] bg-white p-5 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8"
              onSubmit={createSampleRequest}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-black/42">
                Request Generator
              </p>
              <h2 className="mt-2 text-[1.25rem] font-semibold tracking-[-0.03em]">
                Create approval request
              </h2>
              <p className="mt-1 text-sm leading-6 text-black/56">
                This is the generic entry point forms can call before changing saved records.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <select
                  className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm"
                  value={requestForm.module_key}
                  onChange={(event) =>
                    setRequestForm((current) => ({ ...current, module_key: event.target.value }))
                  }
                >
                  {approvalModules.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm"
                  value={requestForm.action_key}
                  onChange={(event) =>
                    setRequestForm((current) => ({ ...current, action_key: event.target.value }))
                  }
                >
                  {approvalActions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Input
                  value={requestForm.entity_type}
                  onChange={(event) =>
                    setRequestForm((current) => ({ ...current, entity_type: event.target.value }))
                  }
                  placeholder="Entity type"
                />
                <Input
                  value={requestForm.entity_id}
                  onChange={(event) =>
                    setRequestForm((current) => ({ ...current, entity_id: event.target.value }))
                  }
                  placeholder="Entity id"
                />
                <Input
                  className="md:col-span-2"
                  value={requestForm.request_title}
                  onChange={(event) =>
                    setRequestForm((current) => ({ ...current, request_title: event.target.value }))
                  }
                  placeholder="Request title"
                />
                <textarea
                  className="min-h-20 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#0071e3] md:col-span-2"
                  value={requestForm.request_reason}
                  onChange={(event) =>
                    setRequestForm((current) => ({ ...current, request_reason: event.target.value }))
                  }
                  placeholder="Reason for change"
                />
                <textarea
                  className="min-h-24 rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-[#0071e3] md:col-span-2"
                  value={requestForm.proposed_payload}
                  onChange={(event) =>
                    setRequestForm((current) => ({ ...current, proposed_payload: event.target.value }))
                  }
                  placeholder='{"field":"new value"}'
                />
              </div>
              <Button className="mt-4 rounded-full bg-black text-white hover:bg-black/86">
                Create Request
              </Button>
            </form>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-5 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-black/42">
            Configured Routes
          </p>
          <div className="mt-4 overflow-x-auto rounded-[22px] ring-1 ring-black/8">
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
                    <td className="px-4 py-3">{label(workflow.module_key)}</td>
                    <td className="px-4 py-3">{label(workflow.action_key)}</td>
                    <td className="px-4 py-3">
                      {(workflow.levels || []).map((level) => level.level_name).join(" -> ") || "NA"}
                    </td>
                    <td className="px-4 py-3">{workflow.is_active ? "Active" : "Inactive"}</td>
                    <td className="px-4 py-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => editWorkflow(workflow)}>
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

      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={() => setPopup({ open: false, type: "info", message: "" })}
      />
    </div>
  );
}
