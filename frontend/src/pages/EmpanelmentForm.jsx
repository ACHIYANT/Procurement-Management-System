import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import FileAttachmentField from "@/components/FileAttachmentField";
import FieldError from "@/components/FieldError";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { postProcurement, procurementRequest, uploadProcurementFile } from "@/lib/procurement-api";
import {
  buildRequiredErrors,
  clearFieldError,
  hasErrors,
  invalidControlClass,
} from "@/lib/form-validation";
import useDebounce from "@/hooks/useDebounce";

const createBlankCategory = () => ({
  category_name: "",
  remarks: "",
  oems: [{ oem_name: "", remarks: "" }],
});

const initialForm = {
  firm_id: "",
  empanelment_no: "",
  valid_from: "",
  valid_upto: "",
  approval_reference: "",
  approval_date: "",
  document_path: "",
  remarks: "",
  item_categories: [createBlankCategory()],
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

const hasNestedErrors = (rows = []) =>
  rows.some((row) => row && typeof row === "object" && Object.keys(row).length > 0);

const getNestedError = (rows, index, field) => rows?.[index]?.[field];

export default function EmpanelmentForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [firmsLoading, setFirmsLoading] = useState(false);
  const [showFirmOptions, setShowFirmOptions] = useState(false);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const [firms, setFirms] = useState([]);
  const [firmSearch, setFirmSearch] = useState("");
  const debouncedFirmSearch = useDebounce(firmSearch, 300);

  const loadFirms = useCallback(async () => {
    setFirmsLoading(true);
    const params = new URLSearchParams();
    if (debouncedFirmSearch) params.set("search", debouncedFirmSearch);
    try {
      const data = await procurementRequest(`/firms?${params.toString()}`);
      setFirms(Array.isArray(data) ? data : []);
    } finally {
      setFirmsLoading(false);
    }
  }, [debouncedFirmSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadFirms().catch((error) =>
        setPopup({ open: true, type: "error", message: error.message || "Unable to fetch firms." }),
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [loadFirms]);

  const uploadEmpanelmentDocument = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadProcurementFile("/files/upload/empanelment_document", formData);
  };

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    clearFieldError(setErrors, field);
  };

  const applyFirmSelection = (firm) => {
    if (!firm) return;
    setForm((current) => ({ ...current, firm_id: String(firm.id) }));
    setFirmSearch(`${firm.firm_name} (${firm.firm_code})`);
    setShowFirmOptions(false);
    clearFieldError(setErrors, "firm_id");
  };

  const updateCategory = (index, field) => (event) => {
    const value = event.target.value;
    setForm((current) => ({
      ...current,
      item_categories: current.item_categories.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
    setErrors((current) => {
      const next = { ...current };
      if (Array.isArray(next.item_categories) && next.item_categories[index]) {
        next.item_categories = [...next.item_categories];
        next.item_categories[index] = { ...next.item_categories[index] };
        delete next.item_categories[index][field];
      }
      return next;
    });
  };

  const updateOem = (categoryIndex, oemIndex, field) => (event) => {
    const value = event.target.value;
    setForm((current) => ({
      ...current,
      item_categories: current.item_categories.map((category, index) => {
        if (index !== categoryIndex) return category;
        return {
          ...category,
          oems: category.oems.map((oem, currentOemIndex) =>
            currentOemIndex === oemIndex ? { ...oem, [field]: value } : oem,
          ),
        };
      }),
    }));
  };

  const addCategory = () => {
    setForm((current) => ({
      ...current,
      item_categories: [...current.item_categories, createBlankCategory()],
    }));
  };

  const removeCategory = (index) => () => {
    setForm((current) => ({
      ...current,
      item_categories:
        current.item_categories.length === 1
          ? [createBlankCategory()]
          : current.item_categories.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const addOem = (categoryIndex) => () => {
    setForm((current) => ({
      ...current,
      item_categories: current.item_categories.map((category, index) =>
        index === categoryIndex
          ? { ...category, oems: [...category.oems, { oem_name: "", remarks: "" }] }
          : category,
      ),
    }));
  };

  const removeOem = (categoryIndex, oemIndex) => () => {
    setForm((current) => ({
      ...current,
      item_categories: current.item_categories.map((category, index) => {
        if (index !== categoryIndex) return category;
        const oems =
          category.oems.length === 1
            ? [{ oem_name: "", remarks: "" }]
            : category.oems.filter((_, currentOemIndex) => currentOemIndex !== oemIndex);
        return { ...category, oems };
      }),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const fieldErrors = buildRequiredErrors(form, [
      { name: "firm_id", label: "Firm" },
      { name: "empanelment_no", label: "Empanelment number" },
      { name: "valid_from", label: "Valid from" },
      { name: "valid_upto", label: "Valid upto" },
    ]);
    const categoryErrors = form.item_categories.map((category) =>
      buildRequiredErrors(category, [{ name: "category_name", label: "Category name" }]),
    );
    const validationErrors = {
      ...fieldErrors,
      item_categories: categoryErrors,
    };
    setErrors(validationErrors);

    if (hasErrors(fieldErrors) || hasNestedErrors(categoryErrors)) return;

    const normalizedCategories = form.item_categories
      .map((category) => ({
        category_name: category.category_name,
        remarks: category.remarks,
        oems: (Array.isArray(category.oems) ? category.oems : []).filter((oem) =>
          String(oem.oem_name || "").trim(),
        ),
      }))
      .filter((category) => String(category.category_name || "").trim());

    if (!normalizedCategories.length) {
      setPopup({ open: true, type: "error", message: "At least one item category is required." });
      return;
    }

    setSaving(true);
    try {
      const data = await postProcurement("/empanelments", {
        ...form,
        item_categories: normalizedCategories,
      });
      navigate(`/empanelments/${data.id}`, { replace: true });
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to save empanelment." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="min-h-full bg-[#f5f5f7] px-4 py-7 text-[#1d1d1f]">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 px-6 py-4">
            <Link to="/empanelments" className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to empanelments
            </Link>
            </div>
            <div className="px-6 py-6 md:px-8 md:py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">Procurement Management System</p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">Add Empanelment</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-white/70 md:text-[15px]">
              Create a firm-wise empanelment with multiple item categories and OEM coverage.
            </p>
            </div>
          </div>

          <Card className="border-0 shadow-lg">
            <CardContent className="space-y-6">
              <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                <div className="grid gap-3 lg:grid-cols-3">
                  <Field label="Firm" error={errors.firm_id}>
                    <div className="relative space-y-2">
                      <Input
                        value={firmSearch}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setFirmSearch(nextValue);
                          setShowFirmOptions(true);
                          setForm((current) => ({
                            ...current,
                            firm_id: "",
                          }));
                          clearFieldError(setErrors, "firm_id");
                        }}
                        onFocus={() => setShowFirmOptions(true)}
                        placeholder="Type firm name, code, GST, or PAN"
                        aria-invalid={Boolean(errors.firm_id)}
                        className={invalidControlClass(errors.firm_id)}
                      />
                      {showFirmOptions ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                          {firmsLoading ? (
                            <div className="px-3 py-3 text-xs text-slate-500">Searching firms...</div>
                          ) : null}
                          {!firmsLoading && String(debouncedFirmSearch || "").trim().length > 0 && firms.length === 0 ? (
                            <div className="px-3 py-3 text-xs text-slate-500">No matching firm found.</div>
                          ) : null}
                          {!firmsLoading && firms.length > 0 ? (
                            <div className="max-h-64 overflow-auto">
                          {firms.map((firm) => (
                            <button
                              key={firm.id}
                              type="button"
                              onClick={() => applyFirmSelection(firm)}
                              className={`flex w-full flex-col items-start gap-1 border-b border-slate-100 px-3 py-3 text-left transition last:border-b-0 hover:bg-slate-50 ${
                                String(form.firm_id) === String(firm.id) ? "bg-blue-50" : ""
                              }`}
                            >
                              <span className="text-sm font-semibold text-slate-900">
                                {firm.firm_name}
                              </span>
                              <span className="text-xs text-slate-500">
                                {firm.firm_code}
                                {firm.gst_no ? ` | ${firm.gst_no}` : " | NO GST"}
                                {firm.primary_contact_value ? ` | ${firm.primary_contact_value}` : ""}
                              </span>
                            </button>
                          ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <input type="hidden" value={form.firm_id} readOnly />
                    </div>
                  </Field>
                  <Field label="Empanelment No." error={errors.empanelment_no}>
                    <Input value={form.empanelment_no} onChange={update("empanelment_no")} className={invalidControlClass(errors.empanelment_no)} />
                  </Field>
                  <Field label="Valid From" error={errors.valid_from}>
                    <Input type="date" value={form.valid_from} onChange={update("valid_from")} className={invalidControlClass(errors.valid_from)} />
                  </Field>
                  <Field label="Valid Upto" error={errors.valid_upto}>
                    <Input type="date" value={form.valid_upto} onChange={update("valid_upto")} className={invalidControlClass(errors.valid_upto)} />
                  </Field>
                  <Field label="Approval Reference">
                    <Input value={form.approval_reference} onChange={update("approval_reference")} />
                  </Field>
                  <Field label="Approval Date">
                    <Input type="date" value={form.approval_date} onChange={update("approval_date")} />
                  </Field>
                  <Field label="Remarks">
                    <Input value={form.remarks} onChange={update("remarks")} />
                  </Field>
                </div>

                <FileAttachmentField
                  label="Empanelment Document"
                  storedPath={form.document_path}
                  onChange={(value) => setForm((current) => ({ ...current, document_path: value }))}
                  onUpload={uploadEmpanelmentDocument}
                  helperText="Upload the empanelment approval or main empanelment document."
                />

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Item Categories</h3>
                      <p className="text-sm text-slate-500">One empanelment can cover multiple item categories and multiple OEMs under each category.</p>
                    </div>
                    <Button type="button" variant="outline" className="gap-2" onClick={addCategory}>
                      <Plus className="h-4 w-4" />
                      Add Category
                    </Button>
                  </div>

                  {form.item_categories.map((category, categoryIndex) => (
                    <div key={`category-${categoryIndex}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">Category {categoryIndex + 1}</p>
                        <Button type="button" variant="ghost" size="sm" className="gap-2 text-rose-600" onClick={removeCategory(categoryIndex)}>
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        <Field label="Category Name" error={getNestedError(errors.item_categories, categoryIndex, "category_name")}>
                          <Input
                            value={category.category_name}
                            onChange={updateCategory(categoryIndex, "category_name")}
                            className={invalidControlClass(getNestedError(errors.item_categories, categoryIndex, "category_name"))}
                          />
                        </Field>
                        <Field label="Category Remarks">
                          <Input value={category.remarks} onChange={updateCategory(categoryIndex, "remarks")} />
                        </Field>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">OEM Mapping</p>
                          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addOem(categoryIndex)}>
                            <Plus className="h-4 w-4" />
                            Add OEM
                          </Button>
                        </div>
                        {category.oems.map((oem, oemIndex) => (
                          <div key={`oem-${categoryIndex}-${oemIndex}`} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 lg:grid-cols-[1fr_1fr_auto]">
                            <Field label="OEM Name">
                              <Input value={oem.oem_name} onChange={updateOem(categoryIndex, oemIndex, "oem_name")} />
                            </Field>
                            <Field label="OEM Remarks">
                              <Input value={oem.remarks} onChange={updateOem(categoryIndex, oemIndex, "remarks")} />
                            </Field>
                            <div className="flex items-end">
                              <Button type="button" variant="ghost" size="sm" className="gap-2 text-rose-600" onClick={removeOem(categoryIndex, oemIndex)}>
                                <Trash2 className="h-4 w-4" />
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <Button type="submit" className="bg-blue-700 text-white hover:bg-blue-800" disabled={saving}>
                  {saving ? "Saving..." : "Save Empanelment"}
                </Button>
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
