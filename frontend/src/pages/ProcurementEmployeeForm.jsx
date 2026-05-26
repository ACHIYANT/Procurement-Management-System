import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import FieldError from "@/components/FieldError";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DIVISION_OPTIONS } from "@/lib/divisions";
import { patchProcurement, postProcurement, procurementRequest } from "@/lib/procurement-api";
import { buildRequiredErrors, hasErrors, invalidControlClass } from "@/lib/form-validation";
import { PMS_ROLES, formatRoleLabel } from "@/lib/roles";

const initialForm = {
  empcode: "",
  employee_name: "",
  mobile_no: "",
  designation: "",
  assigned_roles: [],
  division: "",
  location_scope: "PANCHKULA",
  is_active: true,
};

const roleOptions = [
  PMS_ROLES.SUPER_ADMIN,
  PMS_ROLES.ADMIN,
  PMS_ROLES.INDENT_INITIATOR,
  PMS_ROLES.PROCUREMENT_OFFICER,
  PMS_ROLES.ASSOCIATE,
  PMS_ROLES.FINANCE_OFFICER,
  PMS_ROLES.APPROVER,
  PMS_ROLES.VIEWER,
];

function Field({ label, children, error }) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      <FieldError message={error} />
    </label>
  );
}

function getDivisionOptionsForForm(selectedValue) {
  const selected = String(selectedValue || "").trim();
  if (!selected) return DIVISION_OPTIONS;
  const exists = DIVISION_OPTIONS.some((option) => option.value === selected);
  if (exists) return DIVISION_OPTIONS;
  return [{ value: selected, label: selected }, ...DIVISION_OPTIONS];
}

export default function ProcurementEmployeeForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(Boolean(isEditMode));
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const divisionOptions = getDivisionOptionsForForm(form.division);

  const loadEmployee = useCallback(async () => {
    if (!isEditMode) return;
    try {
      setLoading(true);
      const data = await procurementRequest(`/procurement-employees/${id}`);
      setForm({
        empcode: data.empcode || "",
        employee_name: data.employee_name || "",
        mobile_no: data.mobile_no || "",
        designation: data.designation || "",
        assigned_roles: Array.isArray(data.assigned_roles) ? data.assigned_roles : [],
        division: data.division || data.department || "",
        location_scope: data.location_scope || "PANCHKULA",
        is_active: Boolean(data.is_active),
      });
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to fetch employee." });
    } finally {
      setLoading(false);
    }
  }, [id, isEditMode]);

  useEffect(() => {
    const timer = setTimeout(() => loadEmployee(), 0);
    return () => clearTimeout(timer);
  }, [loadEmployee]);

  const update = (field) => (event) => {
    const value = field === "is_active" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const toggleRole = (roleCode) => {
    setForm((current) => {
      const currentRoles = Array.isArray(current.assigned_roles) ? current.assigned_roles : [];
      const nextRoles = currentRoles.includes(roleCode)
        ? currentRoles.filter((role) => role !== roleCode)
        : [...currentRoles, roleCode];

      return {
        ...current,
        assigned_roles: nextRoles,
      };
    });
    setErrors((current) => ({ ...current, assigned_roles: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationErrors = buildRequiredErrors(form, [
      { name: "empcode", label: "Employee code" },
      { name: "employee_name", label: "Employee name" },
      { name: "mobile_no", label: "Mobile number" },
      { name: "designation", label: "Designation" },
      { name: "division", label: "Division" },
      { name: "location_scope", label: "Location scope" },
    ]);
    if (!Array.isArray(form.assigned_roles) || !form.assigned_roles.length) {
      validationErrors.assigned_roles = "Select at least one role.";
    }
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    setSaving(true);
    try {
      if (isEditMode) {
        await patchProcurement(`/procurement-employees/${id}`, form);
        setPopup({ open: true, type: "success", message: "Employee updated successfully." });
      } else {
        await postProcurement("/procurement-employees", form);
        setPopup({ open: true, type: "success", message: "Employee created successfully." });
      }
      navigate("/administration", { replace: true });
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to save employee." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-full place-items-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-700" />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-full bg-[#f5f5f7] px-4 py-7 text-[#1d1d1f]">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 px-6 py-4">
            <Link to="/administration" className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to administration
            </Link>
            </div>
            <div className="px-6 py-6 md:px-8 md:py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">Administration</p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">
              {isEditMode ? "Edit Procurement Employee" : "Add Procurement Employee"}
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-white/70 md:text-[15px]">
              Maintain the master used in account activation and dealing-officer assignment flows.
            </p>
            </div>
          </div>

          <Card className="border-0 shadow-xl">
            <CardContent className="p-6">
              <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit} noValidate>
                <Field label="Employee Code" error={errors.empcode}>
                  <Input value={form.empcode} onChange={update("empcode")} className={invalidControlClass(errors.empcode)} />
                </Field>
                <Field label="Employee Name" error={errors.employee_name}>
                  <Input value={form.employee_name} onChange={update("employee_name")} className={invalidControlClass(errors.employee_name)} />
                </Field>
                <Field label="Designation" error={errors.designation}>
                  <Input
                    value={form.designation}
                    onChange={update("designation")}
                    className={invalidControlClass(errors.designation)}
                    placeholder="Deputy Manager, Assistant Manager, Accounts Officer..."
                  />
                </Field>
                <Field label="Division" error={errors.division}>
                  <select
                    value={form.division}
                    onChange={update("division")}
                    className={`h-11 w-full rounded-md border bg-white px-3 text-sm text-slate-900 ${invalidControlClass(errors.division)}`}
                  >
                    <option value="">Select division</option>
                    {divisionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Mobile Number" error={errors.mobile_no}>
                  <Input value={form.mobile_no} onChange={update("mobile_no")} className={invalidControlClass(errors.mobile_no)} />
                </Field>
                <Field label="Location Scope" error={errors.location_scope}>
                  <Input
                    value={form.location_scope}
                    readOnly
                    disabled
                    className={invalidControlClass(errors.location_scope)}
                  />
                </Field>
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={Boolean(form.is_active)}
                    onChange={update("is_active")}
                    className="h-4 w-4 rounded border-slate-300 text-blue-700"
                  />
                  Employee is active and available for activation and assignment workflows
                </label>
                <Field label="Assigned Roles" error={errors.assigned_roles}>
                  <div className={`rounded-xl border bg-white p-3 ${errors.assigned_roles ? "border-rose-400" : "border-slate-200"}`}>
                    <div className="flex flex-wrap gap-2">
                      {roleOptions.map((roleCode) => {
                        const checked = Array.isArray(form.assigned_roles) && form.assigned_roles.includes(roleCode);
                        return (
                          <label
                            key={roleCode}
                            className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                              checked
                                ? "border-blue-600 bg-blue-50 text-blue-900"
                                : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRole(roleCode)}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
                            />
                            <span>{formatRoleLabel(roleCode)}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Access roles are assigned here. Designation remains the employee&apos;s office title.
                    </p>
                  </div>
                </Field>
                <div className="md:col-span-2 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => navigate("/administration")}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-blue-700 text-white hover:bg-blue-800" disabled={saving}>
                    {saving ? "Saving..." : isEditMode ? "Update Employee" : "Save Employee"}
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
