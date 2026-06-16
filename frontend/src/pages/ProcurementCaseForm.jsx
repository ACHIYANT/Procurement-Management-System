import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import FieldError from "@/components/FieldError";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { patchProcurement, postProcurement, procurementRequest } from "@/lib/procurement-api";
import { buildRequiredErrors, hasErrors, invalidControlClass } from "@/lib/form-validation";
import { getCurrentUserProfile } from "@/lib/roles";

const initialForm = {
  indent_id: "",
  title: "",
  procurement_officer_id: "",
  procurement_mode: "tender_gem",
  estimated_value: "",
  location_scope: "PANCHKULA",
  remarks: "",
};

const procurementModes = [
  { value: "tender_gem", label: "Tender - GeM" },
  { value: "tender_nic", label: "Tender - NIC" },
  { value: "tender_split", label: "Tender - 50% GeM / 50% NIC" },
  { value: "empanelled_vendor", label: "Empanelled Vendor" },
  { value: "direct_vendor", label: "Direct Vendor" },
  { value: "open_market", label: "Open Market" },
];

const formatQuantity = (value) => {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) return value || "0";
  return Number.isInteger(numeric) ? String(numeric) : String(numeric);
};

function Field({ label, children, error }) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      <FieldError message={error} />
    </label>
  );
}

export default function ProcurementCaseForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const preselectedIndentId = searchParams.get("indentId") || "";
  const approvalRequestId = searchParams.get("approvalRequestId") || "";
  const isEditMode = Boolean(id);
  const [currentUser] = useState(() => getCurrentUserProfile());
  const [form, setForm] = useState(() => ({ ...initialForm, indent_id: preselectedIndentId }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingIndent, setLoadingIndent] = useState(false);
  const [indents, setIndents] = useState([]);
  const [indentDetail, setIndentDetail] = useState(null);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const currentOfficer = useMemo(
    () =>
      employees.find(
        (employee) =>
          String(employee?.empcode || "").trim() === String(currentUser?.empcode || "").trim(),
      ) || null,
    [currentUser?.empcode, employees],
  );

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [indentData, employeeData] = await Promise.all([
          procurementRequest("/indents?cursorMode=true&limit=100"),
          procurementRequest("/procurement-employees?activeOnly=true"),
        ]);
        setIndents(Array.isArray(indentData?.rows) ? indentData.rows : []);
        setEmployees(Array.isArray(employeeData) ? employeeData : []);
      } catch {
        setIndents([]);
        setEmployees([]);
      }
    };

    const timer = setTimeout(() => loadLookups(), 0);
    return () => clearTimeout(timer);
  }, []);

  const loadIndentDetail = useCallback(async (indentId) => {
    if (!indentId) {
      setIndentDetail(null);
      setSelectedItemIds([]);
      return;
    }
    try {
      setLoadingIndent(true);
      const data = await procurementRequest(`/indents/${indentId}`);
      setIndentDetail(data);
      if (isEditMode) return;
      const pendingItems = (Array.isArray(data?.items) ? data.items : [])
        .filter((item) => String(item.procurement_decision_status || "").toLowerCase() !== "case_created")
        .filter((item) => ["assigned", "reassigned"].includes(String(item.assignment_status || "").toLowerCase()))
        .filter(
          (item) =>
            currentOfficer &&
            String(item?.procurement_officer?.empcode || "").trim() === String(currentOfficer.empcode || "").trim(),
        )
        .map((item) => item.id);
      setSelectedItemIds(pendingItems);
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to load indent items." });
      setIndentDetail(null);
      setSelectedItemIds([]);
    } finally {
      setLoadingIndent(false);
    }
  }, [currentOfficer, isEditMode]);

  useEffect(() => {
    if (!isEditMode || !id) return undefined;

    const loadProcurementCase = async () => {
      try {
        const data = await procurementRequest(`/procurement-cases/${id}`);
        setForm({
          indent_id: data?.indent_id ? String(data.indent_id) : "",
          title: data?.title || "",
          procurement_officer_id: data?.procurement_officer_id ? String(data.procurement_officer_id) : "",
          procurement_mode: data?.procurement_mode || "tender_gem",
          estimated_value: data?.estimated_value ?? "",
          location_scope: data?.location_scope || "PANCHKULA",
          remarks: data?.remarks || "",
        });
        setSelectedItemIds(
          (Array.isArray(data?.case_items) ? data.case_items : [])
            .map((caseItem) => caseItem?.indent_item_id)
            .filter(Boolean),
        );
      } catch (error) {
        setPopup({
          open: true,
          type: "error",
          message: error.message || "Unable to load procurement case.",
        });
      }
    };

    const timer = setTimeout(() => loadProcurementCase(), 0);
    return () => clearTimeout(timer);
  }, [id, isEditMode]);

  useEffect(() => {
    const timer = setTimeout(() => loadIndentDetail(form.indent_id), 0);
    return () => clearTimeout(timer);
  }, [form.indent_id, loadIndentDetail]);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const toggleItem = (itemId) => {
    if (isEditMode) return;
    setSelectedItemIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  };

  const selectableItems = useMemo(
    () =>
      (Array.isArray(indentDetail?.items) ? indentDetail.items : []).filter(
        (item) =>
          currentOfficer &&
          ["assigned", "reassigned"].includes(String(item?.assignment_status || "").toLowerCase()) &&
          String(item?.procurement_officer?.empcode || "").trim() === String(currentOfficer.empcode || "").trim(),
      ),
    [currentOfficer, indentDetail],
  );

  const unestimatedAssignedItems = useMemo(
    () =>
      selectableItems.filter((item) => Number(item?.estimated_amount || 0) <= 0),
    [selectableItems],
  );

  const computedEstimatedValue = useMemo(() => {
    const selectedIdSet = new Set(selectedItemIds.map((itemId) => Number(itemId)));
    const total = selectableItems.reduce((sum, item) => {
      if (!selectedIdSet.has(Number(item?.id))) return sum;
      return sum + Number(item?.estimated_amount || 0);
    }, 0);
    return total.toFixed(2);
  }, [selectableItems, selectedItemIds]);

  useEffect(() => {
    if (isEditMode) return;
    setForm((current) => {
      if (current.estimated_value === computedEstimatedValue) return current;
      return {
        ...current,
        estimated_value: computedEstimatedValue,
      };
    });
  }, [computedEstimatedValue, isEditMode]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationErrors = buildRequiredErrors(form, [
      { name: "indent_id", label: "Indent" },
      { name: "title", label: "Case title" },
      { name: "procurement_mode", label: "Procurement mode" },
    ]);
    if (!isEditMode && !selectedItemIds.length) {
      validationErrors.item_ids = "Select at least one indent item.";
    }
    if (!isEditMode && unestimatedAssignedItems.length) {
      validationErrors.item_ids =
        "Procurement case can be created only after estimated value is recorded for all items currently assigned to you under this indent.";
    }
    if (isEditMode && !approvalRequestId) {
      validationErrors.approval_request_id = "Approved update request is required.";
    }
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    setSaving(true);
    try {
      if (isEditMode) {
        const data = await patchProcurement(`/procurement-cases/${id}`, {
          title: form.title,
          procurement_mode: form.procurement_mode,
          remarks: form.remarks,
          approval_request_id: approvalRequestId,
          actor_empcode: currentUser?.empcode || "",
          actor_name:
            currentUser?.employee_name ||
            currentUser?.fullname ||
            currentUser?.fullName ||
            "",
        });
        navigate(`/procurement-cases/${data.id}`, { replace: true });
        return;
      }

      const data = await postProcurement("/procurement-cases", {
        ...form,
        location_scope: "PANCHKULA",
        procurement_officer_id: currentOfficer?.id || null,
        item_ids: selectedItemIds,
      });
      navigate(`/procurement-cases/${data.id}`, { replace: true });
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to save procurement case." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="min-h-full bg-[#f5f5f7] px-4 py-7 text-[#1d1d1f]">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 px-6 py-4">
            <Link to="/procurement-cases" className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to procurement cases
            </Link>
            </div>
            <div className="px-6 py-6 md:px-8 md:py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">Procurement Case</p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">
              {isEditMode ? "Apply Approved Case Update" : "Add Procurement Case"}
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-white/70 md:text-[15px]">
              {isEditMode
                ? "Update the approved saved-record fields for this procurement case. Item mapping remains locked for audit safety."
                : "Group your assigned indent items into one procurement strategy package. Use one case for items moving together in the same route or tender cycle."}
            </p>
            </div>
          </div>

          <Card className="border-0 shadow-xl">
            <CardContent className="space-y-6">
              <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Indent" error={errors.indent_id}>
                    <select
                      className={`h-10 w-full rounded-md border bg-white px-3 text-sm ${invalidControlClass(errors.indent_id)}`}
                      value={form.indent_id}
                      onChange={update("indent_id")}
                      disabled={isEditMode}
                    >
                      <option value="">Select indent</option>
                      {indents.map((indent) => (
                        <option key={indent.id} value={indent.id}>
                          {indent.indent_no} | {indent.department_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Case Title" error={errors.title}>
                    <Input value={form.title} onChange={update("title")} className={invalidControlClass(errors.title)} />
                  </Field>
                  <Field label="Procurement Mode" error={errors.procurement_mode}>
                    <select
                      className={`h-10 w-full rounded-md border bg-white px-3 text-sm ${invalidControlClass(errors.procurement_mode)}`}
                      value={form.procurement_mode}
                      onChange={update("procurement_mode")}
                    >
                      {procurementModes.map((mode) => (
                        <option key={mode.value} value={mode.value}>
                          {mode.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Estimated Value">
                    <Input value={form.estimated_value} readOnly disabled />
                  </Field>
                </div>

                <Field label="Remarks">
                  <textarea
                    rows={3}
                    value={form.remarks}
                    onChange={update("remarks")}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </Field>

                {isEditMode ? (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    <p className="font-semibold">Approved update mode</p>
                    <p className="mt-1">
                      You can correct case title, procurement mode, and remarks. Linked indent items are view-only here to keep the downstream tender audit trail clean.
                    </p>
                    <FieldError message={errors.approval_request_id} />
                  </div>
                ) : null}

                {!isEditMode ? (
                <div className="space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">Select Indent Items</h2>
                    <p className="text-sm text-slate-500">
                      Only your assigned items that are not already linked with another procurement case can be selected here.
                    </p>
                    {unestimatedAssignedItems.length ? (
                      <p className="mt-2 text-sm font-medium text-amber-700">
                        Estimate pending for {unestimatedAssignedItems.length} assigned item(s). Finish all your assigned item estimates under this indent before creating the procurement case.
                      </p>
                    ) : null}
                  </div>
                  <FieldError message={errors.item_ids} />
                  {loadingIndent ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                      Loading indent items...
                    </div>
                  ) : selectableItems.length ? (
                    <div className="space-y-3">
                      {selectableItems.map((item) => {
                        const alreadyLinked = String(item.procurement_decision_status || "").toLowerCase() === "case_created";
                        const checked = selectedItemIds.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${
                              alreadyLinked
                                ? "border-slate-200 bg-slate-100 opacity-75"
                                : checked
                                  ? "border-blue-400 bg-blue-50"
                                  : "border-slate-200 bg-white hover:border-blue-200"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700"
                              checked={checked}
                              disabled={alreadyLinked}
                              onChange={() => toggleItem(item.id)}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-slate-950">{item.item_name}</p>
                                  <p className="text-sm text-slate-600">{item.specification}</p>
                                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                                    {item.category?.category_name || "Uncategorized"} / {item.subcategory?.subcategory_name || "NA"}
                                  </p>
                                </div>
                                <div className="text-sm text-slate-600 md:text-right">
                                  <p>{formatQuantity(item.quantity)} {item.unit}</p>
                                  <p>{item.procurement_officer?.employee_name || "Unassigned"}</p>
                                </div>
                              </div>
                              <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
                                {alreadyLinked ? "Already case created" : "Available for case mapping"}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                      Select an indent first to see your available assigned items.
                    </div>
                  )}
                </div>
                ) : null}

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className="bg-blue-700 text-white hover:bg-blue-800"
                    disabled={saving || (!isEditMode && Boolean(unestimatedAssignedItems.length))}
                  >
                    {saving ? "Saving..." : isEditMode ? "Apply Approved Update" : "Save Procurement Case"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={() => setPopup({ open: false, type: "info", message: "" })}
      />
    </>
  );
}
