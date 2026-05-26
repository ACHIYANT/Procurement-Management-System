import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import FileAttachmentField from "@/components/FileAttachmentField";
import FieldError from "@/components/FieldError";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  postProcurement,
  procurementRequest,
  uploadProcurementFile,
} from "@/lib/procurement-api";
import {
  buildRequiredErrors,
  clearFieldError,
  hasErrors,
  invalidControlClass,
} from "@/lib/form-validation";
import { getHaryanaGovernmentMasterOptions } from "@/lib/haryana-government-master";

const initialForm = {
  department_name: "",
  subject: "",
  entry_type: "parked",
  entry_origin: "department_funds",
  amount: "",
  entry_date: "",
  reference_no: "",
  financial_year: "",
  estimate_reference: "",
  estimate_date: "",
  estimate_amount: "",
  indent_id: "",
  tender_id: "",
  po_id: "",
  vendor_name: "",
  noting_page_path: "",
  payment_noting_path: "",
  remarks: "",
  location_scope: "PANCHKULA",
};

const ENTRY_TYPE_OPTIONS = [
  ["parked", "Parked"],
  ["received", "Received"],
  ["vendor_payment", "Vendor Payment"],
  ["adjusted", "Adjusted"],
  ["refunded", "Refunded"],
  ["carry_forward", "Carry Forward"],
];

const today = new Date().toISOString().slice(0, 10);

function Field({ label, children, error }) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      <FieldError message={error} />
    </label>
  );
}

export default function DepartmentFundForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const origin = searchParams.get("origin") === "historical_reconciliation"
    ? "historical_reconciliation"
    : "department_funds";
  const [form, setForm] = useState({
    ...initialForm,
    entry_origin: origin,
    entry_date: today,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const [linkOptions, setLinkOptions] = useState({
    indents: [],
    tenders: [],
    purchaseOrders: [],
  });

  const pageMeta = useMemo(
    () =>
      origin === "historical_reconciliation"
        ? {
            title: "Add Historical Reconciliation Entry",
            subtitle:
              "Use this only for historical finance records that were outside live PMS flow and now need reconciliation backfill.",
            backTo: "/reconciliation",
            backLabel: "Back to reconciliation",
          }
        : {
            title: "Add Department Fund Entry",
            subtitle:
              "Capture department-side fund movement once here. Reconciliation will later consume these entries with live PMS records.",
            backTo: "/department-funds",
            backLabel: "Back to department funds",
          },
    [origin],
  );

  const departmentOptions = useMemo(
    () =>
      getHaryanaGovernmentMasterOptions().filter(
        (entry) => entry.group === "Department" || entry.depth > 0,
      ),
    [],
  );

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setLoadingLinks(true);
        const [indents, tenders, purchaseOrders] = await Promise.all([
          procurementRequest("/indents"),
          procurementRequest("/tenders"),
          procurementRequest("/purchase-orders"),
        ]);
        setLinkOptions({
          indents: Array.isArray(indents) ? indents : [],
          tenders: Array.isArray(tenders) ? tenders : [],
          purchaseOrders: Array.isArray(purchaseOrders) ? purchaseOrders : [],
        });
      } catch (error) {
        setPopup({
          open: true,
          type: "error",
          message: error.message || "Unable to load linking options.",
        });
      } finally {
        setLoadingLinks(false);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const uploadNotingPage = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadProcurementFile("/files/upload/department_fund_noting", formData);
  };

  const uploadPaymentNoting = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadProcurementFile("/files/upload/department_payment_noting", formData);
  };

  const update = (field) => (event) => {
    const nextValue = event.target.value;
    setForm((current) => {
      if (field !== "entry_type") return { ...current, [field]: nextValue };

      if (nextValue === "vendor_payment") {
        return { ...current, entry_type: nextValue };
      }

      return {
        ...current,
        entry_type: nextValue,
        vendor_name: "",
        payment_noting_path: "",
      };
    });
    clearFieldError(setErrors, field);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationErrors = buildRequiredErrors(form, [
      { name: "department_name", label: "Department" },
      { name: "subject", label: "Subject" },
      { name: "entry_type", label: "Entry Type" },
      { name: "amount", label: "Amount" },
      { name: "entry_date", label: "Entry Date" },
      { name: "location_scope", label: "Location Scope" },
    ]);
    if (form.entry_type === "vendor_payment") {
      if (!String(form.vendor_name || "").trim()) {
        validationErrors.vendor_name = "Vendor Name is required.";
      }
      if (!String(form.tender_id || "").trim()) {
        validationErrors.tender_id = "Tender is required for vendor payment history.";
      }
    }
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    setSaving(true);
    try {
      await postProcurement("/department-funds", {
        ...form,
        indent_id: form.indent_id || null,
        tender_id: form.tender_id || null,
        po_id: form.po_id || null,
      });
      navigate(pageMeta.backTo, { replace: true });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to save department fund entry.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="min-h-full bg-transparent px-4 py-7 text-[#1d1d1f]">
        <div className="mx-auto max-w-[1500px] space-y-5">
          <div className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 px-6 py-4 md:px-8">
            <Link
              to={pageMeta.backTo}
              className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {pageMeta.backLabel}
            </Link>
            </div>
            <div className="px-6 py-6 md:px-8 md:py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">
              Financial Tracking
            </p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] md:text-[2.35rem]">{pageMeta.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70 md:text-[15px]">
              {pageMeta.subtitle}
            </p>
            </div>
          </div>

          <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
            <CardContent>
              <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Core Entry
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Department" error={errors.department_name}>
                      <select
                        className={`h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm ${invalidControlClass(errors.department_name)}`}
                        value={form.department_name}
                        onChange={update("department_name")}
                      >
                        <option value="">Select department</option>
                        {departmentOptions.map((option) => (
                          <option key={`${option.rawValue}-${option.depth}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Entry Type" error={errors.entry_type}>
                      <select
                        className={`h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm ${invalidControlClass(errors.entry_type)}`}
                        value={form.entry_type}
                        onChange={update("entry_type")}
                      >
                        {ENTRY_TYPE_OPTIONS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Subject" error={errors.subject}>
                      <Input
                        value={form.subject}
                        onChange={update("subject")}
                        className={invalidControlClass(errors.subject)}
                        placeholder={
                          form.entry_type === "vendor_payment"
                            ? "Payment purpose like 1st payment, leftover payment, final payment"
                            : "Purpose / case subject"
                        }
                      />
                    </Field>
                    <Field
                      label={form.entry_type === "vendor_payment" ? "Payment Amount" : "Amount"}
                      error={errors.amount}
                    >
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.amount}
                        onChange={update("amount")}
                        className={invalidControlClass(errors.amount)}
                      />
                    </Field>
                    <Field
                      label={form.entry_type === "vendor_payment" ? "Payment Date" : "Entry Date"}
                      error={errors.entry_date}
                    >
                      <Input
                        type="date"
                        max={today}
                        value={form.entry_date}
                        onChange={update("entry_date")}
                        className={invalidControlClass(errors.entry_date)}
                      />
                    </Field>
                    <Field label="Reference No.">
                      <Input value={form.reference_no} onChange={update("reference_no")} />
                    </Field>
                    <Field label="Financial Year">
                      <Input value={form.financial_year} onChange={update("financial_year")} placeholder="2026-27" />
                    </Field>
                    <Field label="Location Scope" error={errors.location_scope}>
                      <Input value={form.location_scope} disabled readOnly />
                    </Field>
                  </div>
                </section>

                {form.entry_type === "vendor_payment" ? (
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Vendor Payment Details
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Vendor Name" error={errors.vendor_name}>
                        <Input
                          value={form.vendor_name}
                          onChange={update("vendor_name")}
                          className={invalidControlClass(errors.vendor_name)}
                          placeholder="Name of vendor / firm paid"
                        />
                      </Field>
                      <Field label="Tender" error={errors.tender_id}>
                        <select
                          className={`h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm ${invalidControlClass(errors.tender_id)}`}
                          value={form.tender_id}
                          onChange={update("tender_id")}
                          disabled={loadingLinks}
                        >
                          <option value="">Select tender</option>
                          {linkOptions.tenders.map((tender) => (
                            <option key={tender.id} value={tender.id}>
                              {tender.tender_title}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </section>
                ) : null}

                <section className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Estimate Context
                  </h2>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Estimate Reference">
                      <Input value={form.estimate_reference} onChange={update("estimate_reference")} />
                    </Field>
                    <Field label="Estimate Date">
                      <Input type="date" max={today} value={form.estimate_date} onChange={update("estimate_date")} />
                    </Field>
                    <Field label="Estimate Amount">
                      <Input type="number" min="0" step="0.01" value={form.estimate_amount} onChange={update("estimate_amount")} />
                    </Field>
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Optional Linkage
                  </h2>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Indent">
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                        value={form.indent_id}
                        onChange={update("indent_id")}
                        disabled={loadingLinks}
                      >
                        <option value="">No indent link</option>
                        {linkOptions.indents.map((indent) => (
                          <option key={indent.id} value={indent.id}>
                            {indent.indent_no} | {indent.department_name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Tender">
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                        value={form.tender_id}
                        onChange={update("tender_id")}
                        disabled={loadingLinks}
                      >
                        <option value="">No tender link</option>
                        {linkOptions.tenders.map((tender) => (
                          <option key={tender.id} value={tender.id}>
                            {tender.tender_title}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Purchase Order">
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                        value={form.po_id}
                        onChange={update("po_id")}
                        disabled={loadingLinks}
                      >
                        <option value="">No PO link</option>
                        {linkOptions.purchaseOrders.map((purchaseOrder) => (
                          <option key={purchaseOrder.id} value={purchaseOrder.id}>
                            {purchaseOrder.po_no}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Note & Supporting File
                  </h2>
                  <div className="grid gap-4">
                    {form.entry_type === "vendor_payment" ? (
                      <FileAttachmentField
                        label="Payment Noting Copy"
                        storedPath={form.payment_noting_path}
                        onChange={(value) =>
                          setForm((current) => ({ ...current, payment_noting_path: value }))
                        }
                        onUpload={uploadPaymentNoting}
                        helperText="Upload the payment noting or approval page for this vendor payment entry."
                      />
                    ) : null}
                    <FileAttachmentField
                      label={
                        form.entry_type === "vendor_payment"
                          ? "Supporting Note / Adjustment Copy"
                          : "Noting / Sanction Copy"
                      }
                      storedPath={form.noting_page_path}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, noting_page_path: value }))
                      }
                      onUpload={uploadNotingPage}
                      helperText="Upload the department note sheet, sanction letter, or supporting finance page."
                    />
                    <Field label="Remarks">
                      <textarea
                        className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        value={form.remarks}
                        onChange={update("remarks")}
                      />
                    </Field>
                  </div>
                </section>

                <Button className="w-full bg-blue-700 text-white hover:bg-blue-800" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : "Save Department Fund Entry"}
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
