import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import FileAttachmentField from "@/components/FileAttachmentField";
import FieldError from "@/components/FieldError";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getHaryanaGovernmentMasterTree } from "@/lib/haryana-government-master";
import {
  patchProcurement,
  postProcurement,
  procurementRequest,
  uploadProcurementFile,
} from "@/lib/procurement-api";
import {
  buildRequiredErrors,
  hasErrors,
  invalidControlClass,
} from "@/lib/form-validation";
import InfoTooltip from "../components/InfoTooltip";
import { getCurrentUserProfile } from "@/lib/roles";

const UNIT_OPTIONS = [
  "Nos",
  "Unit",
  "Set",
  "Pair",
  "Packet",
  "Box",
  "Roll",
  "Bottle",
  "Kg",
  "Gram",
  "Litre",
  "Meter",
  "Feet",
  "Bundle",
];

const createBlankItem = () => ({
  category_id: "",
  subcategory_id: "",
  item_name: "",
  quantity: "",
  unit: "",
  specific_make_required: "no",
  preferred_make: "",
  remarks: "",
});

const initialForm = {
  indent_no: "",
  indent_date: "",
  department_name: "",
  cfms_no: "",
  received_date: "",
  indent_document_path: "",
  specification_document_path: "",
  administrative_approval_document_path: "",
  administrative_approval_remarks: "",
  location_scope: "PANCHKULA",
  remarks: "",
  items: [createBlankItem()],
};

const toDateInput = (value) => (value ? String(value).slice(0, 10) : "");

const toQuantityInput = (value) => {
  if (value === undefined || value === null || value === "") return "";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : String(value);
};

const mapIndentToForm = (indent = {}) => ({
  indent_no: indent.indent_no || "",
  indent_date: toDateInput(indent.indent_date),
  department_name: indent.department_name || "",
  cfms_no: indent.cfms_no || "",
  received_date: toDateInput(indent.received_date),
  indent_document_path: indent.indent_document_path || "",
  specification_document_path: indent.specification_document_path || "",
  administrative_approval_document_path:
    indent.administrative_approval_document_path || "",
  administrative_approval_remarks: indent.administrative_approval_remarks || "",
  location_scope: indent.location_scope || "PANCHKULA",
  remarks: indent.remarks || "",
  items: Array.isArray(indent.items) && indent.items.length
    ? indent.items.map((item) => ({
        category_id: item.category_id ? String(item.category_id) : "",
        subcategory_id: item.subcategory_id ? String(item.subcategory_id) : "",
        item_name: item.item_name || "",
        quantity: toQuantityInput(item.quantity),
        unit: item.unit || "",
        specific_make_required: item.specific_make_required ? "yes" : "no",
        preferred_make: item.preferred_make || "",
        remarks: item.remarks || "",
      }))
    : [createBlankItem()],
});

function Field({ label: title, children, error }) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium text-slate-700">{title}</span>
      {children}
      <FieldError message={error} />
    </label>
  );
}

function DepartmentPicker({ value, onChange, error, options }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;

    return options
      .map((parent) => {
        const parentMatch =
          parent.label.toLowerCase().includes(term) ||
          parent.group.toLowerCase().includes(term);
        const matchingChildren = (parent.children || []).filter(
          (child) =>
            child.label.toLowerCase().includes(term) ||
            child.group.toLowerCase().includes(term),
        );

        if (parentMatch) return parent;
        if (matchingChildren.length)
          return { ...parent, children: matchingChildren };
        return null;
      })
      .filter(Boolean);
  }, [options, search]);

  const selectedLabel = value || "";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 text-left text-sm shadow-sm transition ${
          error
            ? "border-red-500 ring-1 ring-red-200"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <span className={selectedLabel ? "text-slate-900" : "text-slate-400"}>
          {selectedLabel || "Select organization / office"}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-500 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-200 p-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search organization, authority, university..."
                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {filteredOptions.length ? (
              <div className="space-y-2">
                {filteredOptions.map((parent) => (
                  <div
                    key={parent.value}
                    className="rounded-xl border border-slate-200 bg-slate-50/75"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onChange(parent.label);
                        setOpen(false);
                        setSearch("");
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-blue-50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-blue-700" />
                          <span className="truncate text-sm font-semibold text-slate-900">
                            {parent.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs uppercase tracking-[0.2em] text-slate-500">
                          {parent.group}
                        </p>
                      </div>
                      {value === parent.label ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : null}
                    </button>

                    {parent.children?.length ? (
                      <div className="border-t border-slate-200 bg-white/85 px-2 py-2">
                        <div className="space-y-1">
                          {parent.children.map((child) => (
                            <button
                              key={child.value}
                              type="button"
                              onClick={() => {
                                onChange(child.label);
                                setOpen(false);
                                setSearch("");
                              }}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-slate-100"
                            >
                              <div className="min-w-0 pl-4">
                                <p className="truncate text-sm text-slate-800">
                                  {child.label}
                                </p>
                                <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                  {child.group}
                                </p>
                              </div>
                              {value === child.label ? (
                                <Check className="h-4 w-4 text-emerald-600" />
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No matching organization or office found.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function IndentForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [currentUser] = useState(() => getCurrentUserProfile());
  const [form, setForm] = useState(initialForm);
  const [itemCategories, setItemCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState("");
  const [popup, setPopup] = useState({
    open: false,
    type: "info",
    message: "",
  });
  const departmentOptions = useMemo(() => getHaryanaGovernmentMasterTree(), []);
  const todayDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const data = await procurementRequest("/item-categories?activeOnly=true");
        setItemCategories(Array.isArray(data) ? data : []);
      } catch (error) {
        setPopup({
          open: true,
          type: "error",
          message: error.message || "Unable to load item categories.",
        });
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isEditMode) {
      const timer = setTimeout(() => {
        setForm(initialForm);
        setErrors({});
      }, 0);
      return () => clearTimeout(timer);
    }

    let ignore = false;
    const timer = setTimeout(async () => {
      try {
        const data = await procurementRequest(`/indents/${id}`);
        if (ignore) return;
        if (String(data?.status || "").toLowerCase() !== "draft") {
          setPopup({
            open: true,
            type: "info",
            message: "This indent is already submitted and cannot be edited as a draft.",
          });
          navigate(`/indents/${id}`, { replace: true });
          return;
        }
        setForm(mapIndentToForm(data));
        setErrors({});
      } catch (error) {
        if (!ignore) {
          setPopup({
            open: true,
            type: "error",
            message: error.message || "Unable to load draft indent.",
          });
        }
      }
    }, 0);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [id, isEditMode, navigate]);

  const uploadIndentDocument = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "filename_base",
      `${form.indent_no || "indent"}_${form.department_name || "organization"}_${form.indent_date || "date"}_indent_document`,
    );
    return uploadProcurementFile("/files/upload/indent_document", formData);
  };

  const uploadAdministrativeApproval = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "filename_base",
      `${form.indent_no || "indent"}_${form.department_name || "organization"}_${form.indent_date || "date"}_administrative_approval`,
    );
    return uploadProcurementFile("/files/upload/indent_admin_approval", formData);
  };

  const uploadSpecificationDocument = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "filename_base",
      `${form.indent_no || "indent"}_${form.department_name || "organization"}_${form.indent_date || "date"}_specification_document`,
    );
    return uploadProcurementFile("/files/upload/indent_specification_document", formData);
  };

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const updateItem = (index, field) => (event) => {
    const value = event.target.value;
    setForm((current) => {
      const items = current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const nextItem = { ...item, [field]: value };
        if (field === "category_id") {
          nextItem.subcategory_id = "";
        }
        if (field === "specific_make_required" && value === "no") {
          nextItem.preferred_make = "";
          nextItem.administrative_approval_document_path = "";
        }
        return nextItem;
      });
      return { ...current, items };
    });
    setErrors((current) => {
      const next = { ...current };
      if (Array.isArray(next.items) && next.items[index]) {
        next.items = [...next.items];
        next.items[index] = { ...next.items[index], [field]: undefined };
      }
      return next;
    });
  };

  const addItem = () => {
    setForm((current) => ({
      ...current,
      items: [...current.items, createBlankItem()],
    }));
  };

  const removeItem = (index) => () => {
    setForm((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? [createBlankItem()]
          : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const buildFinalValidationErrors = () => {
    const fieldErrors = buildRequiredErrors(form, [
      { name: "indent_no", label: "Indent number" },
      { name: "indent_date", label: "Indent date" },
      { name: "department_name", label: "Indenting organization" },
      { name: "received_date", label: "Received date" },
      { name: "indent_document_path", label: "Indent document" },
      { name: "location_scope", label: "Location scope" },
    ]);

    const itemErrors = form.items.map((item) => {
      const nextErrors = buildRequiredErrors(item, [
        { name: "item_name", label: "Item name" },
        { name: "category_id", label: "Category" },
        { name: "subcategory_id", label: "Sub category" },
        { name: "quantity", label: "Quantity" },
        { name: "unit", label: "Unit" },
      ]);
      if (item.specific_make_required === "yes" && !String(item.preferred_make || "").trim()) {
        nextErrors.preferred_make = "Specific make / company is required.";
      }
      return nextErrors;
    });

    return { fieldErrors, itemErrors, validationErrors: { ...fieldErrors, items: itemErrors } };
  };

  const hasDraftContent = () => {
    const headerFields = [
      "indent_no",
      "indent_date",
      "department_name",
      "cfms_no",
      "received_date",
      "indent_document_path",
      "specification_document_path",
      "administrative_approval_document_path",
      "administrative_approval_remarks",
      "remarks",
    ];
    const hasHeader = headerFields.some((field) =>
      String(form[field] || "").trim(),
    );
    const hasItem = form.items.some((item) =>
      [
        item.category_id,
        item.subcategory_id,
        item.item_name,
        item.quantity,
        item.unit,
        item.preferred_make,
        item.remarks,
      ].some((value) => String(value || "").trim()),
    );
    return hasHeader || hasItem;
  };

  const buildPayload = (draft) => ({
    ...form,
    save_as_draft: draft,
    status: draft ? "draft" : "received",
    actor_empcode: currentUser?.empcode || "",
    actor_name: currentUser?.fullName || "",
    location_scope: "PANCHKULA",
    cfms_no: form.cfms_no || null,
    items: form.items.map((item) => ({
      ...item,
      administrative_approval_required: item.specific_make_required === "yes",
    })),
  });

  const saveIndent = async ({ draft }) => {
    if (draft && !hasDraftContent()) {
      setPopup({
        open: true,
        type: "error",
        message: "Enter at least one indent detail before saving a draft.",
      });
      return;
    }

    if (!draft) {
      const { fieldErrors, itemErrors, validationErrors } = buildFinalValidationErrors();
      setErrors(validationErrors);

      if (
        hasErrors(fieldErrors) ||
        itemErrors.some((itemError) => hasErrors(itemError))
      )
        return;
    } else {
      setErrors({});
    }

    setSaving(draft ? "draft" : "submit");
    try {
      const payload = buildPayload(draft);
      const data = isEditMode
        ? await patchProcurement(`/indents/${id}`, payload)
        : await postProcurement("/indents", payload);

      if (draft) {
        setForm(mapIndentToForm(data));
        setPopup({
          open: true,
          type: "success",
          message: "Draft indent saved.",
        });
        if (!isEditMode) {
          navigate(`/indents/${data.id}/edit`, { replace: true });
        }
        return;
      }

      navigate(`/indents/${data.id}`, { replace: true });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to save indent.",
      });
    } finally {
      setSaving("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await saveIndent({ draft: false });
  };

  const handleSaveDraft = async () => {
    await saveIndent({ draft: true });
  };

  return (
    <>
      <div className="min-h-full bg-[#f5f5f7] px-4 py-7 text-[#1d1d1f]">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 px-6 py-4">
            <Link
              to="/indents"
              className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to indents
            </Link>
            </div>
            <div className="px-6 py-6 md:px-8 md:py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">
              Indent Master
            </p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">
              {isEditMode ? "Edit Draft Indent" : "Add Indent"}
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-white/70 md:text-[15px]">
              {isEditMode
                ? "Continue a saved draft. Submit only when the inward letter, mandatory dates, upload, and item lines are complete."
                : "Record the inward indent letter and its item lines. Save as draft if details are still being collected."}
            </p>
            </div>
          </div>

          <Card className="border-0 shadow-xl">
            <CardContent className="space-y-6">
              <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field
                    label={
                      <span className="inline-flex items-center gap-2">
                        <span>Indent No.</span>
                        <InfoTooltip content="Mention Letter No./Reference No./Memo no. of the letter received from the indenting organisation." />
                      </span>
                    }
                    error={errors.indent_no}
                  >
                    <Input
                      value={form.indent_no}
                      onChange={update("indent_no")}
                      className={invalidControlClass(errors.indent_no)}
                    />
                  </Field>
                  <Field label="Indent Date" error={errors.indent_date}>
                    <Input
                      type="date"
                      value={form.indent_date}
                      max={todayDate}
                      onChange={update("indent_date")}
                      className={invalidControlClass(errors.indent_date)}
                    />
                  </Field>
                  <Field label="Location Scope" error={errors.location_scope}>
                    <Input
                      value={form.location_scope}
                      readOnly
                      disabled
                      className={invalidControlClass(errors.location_scope)}
                    />
                  </Field>
                  <Field
                    label="Indenting Organization"
                    error={errors.department_name}
                  >
                    <DepartmentPicker
                      value={form.department_name}
                      onChange={(nextValue) => {
                        setForm((current) => ({
                          ...current,
                          department_name: nextValue,
                        }));
                        setErrors((current) => ({
                          ...current,
                          department_name: undefined,
                        }));
                      }}
                      error={errors.department_name}
                      options={departmentOptions}
                    />
                  </Field>
                  <Field label="CFMS No." error={errors.cfms_no}>
                    <Input
                      value={form.cfms_no}
                      onChange={update("cfms_no")}
                      className={invalidControlClass(errors.cfms_no)}
                    />
                  </Field>
                  <Field
                    label={
                      <span className="inline-flex items-center gap-2">
                        <span>Indent Received Date</span>
                        <InfoTooltip content="Enter the actual date on which the indent letter was received in procurement." />
                      </span>
                    }
                    error={errors.received_date}
                  >
                    <Input
                      type="date"
                      value={form.received_date}
                      max={todayDate}
                      onChange={update("received_date")}
                      className={invalidControlClass(errors.received_date)}
                    />
                  </Field>
                </div>

                <div className="md:max-w-3xl">
                  <FileAttachmentField
                    label="Indent Upload"
                    storedPath={form.indent_document_path}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, indent_document_path: value }))
                    }
                    onUpload={uploadIndentDocument}
                    error={errors.indent_document_path}
                    helperText="Upload the inward indent letter received from the indenting organization."
                  />
                </div>

                <div className="md:max-w-3xl">
                  <FileAttachmentField
                    label="Specification File"
                    storedPath={form.specification_document_path}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        specification_document_path: value,
                      }))
                    }
                    onUpload={uploadSpecificationDocument}
                    helperText="Optional. Upload now if available, or add it later from the indent detail page."
                    emptyLabel="No specification file uploaded yet"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-950">
                        Indent Items
                      </h2>
                      <p className="text-sm text-slate-500">
                        Capture inward item requirements, preferred make, and
                        approval need. Estimates and assignment happen after the
                        indent is received.
                      </p>
                    </div>
                    <Button
                      type="button"
                      className="gap-2 bg-blue-700 text-white hover:bg-blue-800"
                      onClick={addItem}
                    >
                      <Plus className="h-4 w-4" />
                      Add Item
                    </Button>
                  </div>

                  {form.items.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Item {index + 1}
                        </h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <Field
                          label="Category"
                          error={errors.items?.[index]?.category_id}
                        >
                          <select
                            value={item.category_id}
                            onChange={updateItem(index, "category_id")}
                            className={`h-10 w-full rounded-md border bg-white px-3 text-sm ${invalidControlClass(
                              errors.items?.[index]?.category_id,
                            )}`}
                          >
                            <option value="">Select category</option>
                            {itemCategories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.category_name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field
                          label="Sub Category"
                          error={errors.items?.[index]?.subcategory_id}
                        >
                          <select
                            value={item.subcategory_id}
                            onChange={updateItem(index, "subcategory_id")}
                            className={`h-10 w-full rounded-md border bg-white px-3 text-sm ${invalidControlClass(
                              errors.items?.[index]?.subcategory_id,
                            )}`}
                            disabled={!item.category_id}
                          >
                            <option value="">Select sub category</option>
                            {(
                              itemCategories.find(
                                (category) =>
                                  String(category.id) === String(item.category_id),
                              )?.subcategories || []
                            ).map((subcategory) => (
                              <option key={subcategory.id} value={subcategory.id}>
                                {subcategory.subcategory_name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field
                          label="Item Name"
                          error={errors.items?.[index]?.item_name}
                        >
                          <Input
                            value={item.item_name}
                            onChange={updateItem(index, "item_name")}
                            className={invalidControlClass(
                              errors.items?.[index]?.item_name,
                            )}
                          />
                        </Field>
                        <Field
                          label="Quantity"
                          error={errors.items?.[index]?.quantity}
                        >
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={item.quantity}
                            onChange={updateItem(index, "quantity")}
                            className={invalidControlClass(
                              errors.items?.[index]?.quantity,
                            )}
                          />
                        </Field>
                        <Field label="Unit" error={errors.items?.[index]?.unit}>
                          <select
                            value={item.unit}
                            onChange={updateItem(index, "unit")}
                            className={`h-10 w-full rounded-md border bg-white px-3 text-sm ${invalidControlClass(
                              errors.items?.[index]?.unit,
                            )}`}
                          >
                            <option value="">Select unit</option>
                            {UNIT_OPTIONS.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Specific Make Required?">
                          <select
                            value={item.specific_make_required}
                            onChange={updateItem(index, "specific_make_required")}
                            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                          >
                            <option value="no">No</option>
                            <option value="yes">Yes</option>
                          </select>
                        </Field>
                        <Field
                          label={
                            <span className="inline-flex items-center gap-2">
                              <span>Item Remarks</span>
                              <InfoTooltip content="Remarks related to the items" />
                            </span>
                          }
                        >
                          <Input
                            value={item.remarks}
                            onChange={updateItem(index, "remarks")}
                          />
                        </Field>
                        {item.specific_make_required === "yes" ? (
                          <>
                            <Field
                              label="Specific Make / Company"
                              error={errors.items?.[index]?.preferred_make}
                            >
                              <Input
                                value={item.preferred_make}
                                onChange={updateItem(index, "preferred_make")}
                                className={invalidControlClass(errors.items?.[index]?.preferred_make)}
                              />
                            </Field>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {form.items.some((item) => item.specific_make_required === "yes") ? (
                  <div className="md:max-w-3xl">
                    <FileAttachmentField
                      label="Administrative Approval Copy"
                      storedPath={form.administrative_approval_document_path}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          administrative_approval_document_path: value,
                        }))
                      }
                      onUpload={uploadAdministrativeApproval}
                      error={errors.administrative_approval_document_path}
                      helperText="Optional. Upload when available from the organization; it can also be added later from the indent detail page."
                    />
                    <Field label="Administrative Approval Remarks">
                      <textarea
                        rows={3}
                        value={form.administrative_approval_remarks}
                        onChange={update("administrative_approval_remarks")}
                        className="mt-4 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </Field>
                  </div>
                ) : null}

                <Field
                  label={
                    <span className="inline-flex items-center gap-2">
                      <span>Remarks</span>
                      <InfoTooltip content="Remarks related to the indent" />
                    </span>
                  }
                >
                  <textarea
                    rows={3}
                    value={form.remarks}
                    onChange={update("remarks")}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </Field>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    disabled={Boolean(saving)}
                    onClick={handleSaveDraft}
                  >
                    {saving === "draft" ? "Saving Draft..." : "Save Draft"}
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-700 text-white hover:bg-blue-800"
                    disabled={Boolean(saving)}
                  >
                    {saving === "submit" ? "Submitting..." : "Submit Indent"}
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
