import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Save } from "lucide-react";

import FileAttachmentField from "@/components/FileAttachmentField";
import FieldError from "@/components/FieldError";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { patchProcurement, procurementRequest, uploadProcurementFile } from "@/lib/procurement-api";
import {
  buildRequiredErrors,
  clearFieldError,
  hasErrors,
  invalidControlClass,
} from "@/lib/form-validation";

const initialForm = {
  emd_submission_status: "not_submitted",
  emd_exemption_status: "none",
  emd_exemption_reason: "",
  tender_fee_amount: "",
  emd_amount: "",
  submission_mode: "",
  instrument_no: "",
  issuing_bank_name: "",
  utr_no: "",
  bg_no: "",
  bg_valid_upto: "",
  bg_claim_period_upto: "",
  deposit_date: "",
  submission_document_path: "",
  finance_reference_no: "",
  is_retained_after_technical_eval: "",
  refund_status: "not_due",
  refund_date: "",
  refund_approval_copy_path: "",
  refund_receiving_copy_path: "",
  received_by_name: "",
  received_by_designation: "",
  remarks: "",
};

function Field({ label, children }) {
  return (
    <label className="space-y-1 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, children, error }) {
  return (
    <select
      className={`h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${invalidControlClass(error)}`}
      value={value}
      onChange={onChange}
      aria-invalid={Boolean(error)}
    >
      {children}
    </select>
  );
}

const valueOrBlank = (value) => (value === null || value === undefined ? "" : String(value));

const formatDateOnly = (value) => {
  if (!value) return "NA";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "NA";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

export default function EmdEdit() {
  const { id } = useParams();
  const location = useLocation();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "", moveTo: "" });
  const backTo = location.state?.returnTo || "/emd";
  const backLabel = location.state?.returnLabel || "Back to EMD list";
  const backState = location.state?.tenderStep
    ? { tenderStep: location.state.tenderStep }
    : undefined;

  const uploadEmdFile = async (scope, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadProcurementFile(`/files/upload/${scope}`, formData);
  };

  const update = (field) => (event) => {
    const value = event.target.value;
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === "emd_submission_status" && value !== "exempted") {
        next.emd_exemption_status = "none";
        next.emd_exemption_reason = "";
      }

      if (field === "submission_mode") {
        next.instrument_no = "";
        next.issuing_bank_name = "";
        next.utr_no = "";
        next.bg_no = "";
        next.bg_valid_upto = "";
        next.bg_claim_period_upto = "";
        next.deposit_date = "";
      }

      if (field === "emd_submission_status" && !["submitted", "transferred_to_hartron"].includes(value)) {
        next.submission_mode = "";
        next.instrument_no = "";
        next.issuing_bank_name = "";
        next.utr_no = "";
        next.bg_no = "";
        next.bg_valid_upto = "";
        next.bg_claim_period_upto = "";
        next.deposit_date = "";
      }

      return next;
    });
    clearFieldError(setErrors, field);
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await procurementRequest(`/emd/${id}`);
        setEntry(data);
        setForm({
          emd_submission_status: valueOrBlank(data.emd_submission_status) || "not_submitted",
          emd_exemption_status: valueOrBlank(data.emd_exemption_status) || "none",
          emd_exemption_reason: valueOrBlank(data.emd_exemption_reason),
          tender_fee_amount: valueOrBlank(data.tender_fee_amount),
          emd_amount: valueOrBlank(data.emd_amount),
          submission_mode: valueOrBlank(data.submission_mode),
          instrument_no: valueOrBlank(data.instrument_no),
          issuing_bank_name: valueOrBlank(data.issuing_bank_name),
          utr_no: valueOrBlank(data.utr_no),
          bg_no: valueOrBlank(data.bg_no),
          bg_valid_upto: valueOrBlank(data.bg_valid_upto),
          bg_claim_period_upto: valueOrBlank(data.bg_claim_period_upto),
          deposit_date: valueOrBlank(data.deposit_date),
          submission_document_path: valueOrBlank(data.submission_document_path),
          finance_reference_no: valueOrBlank(data.finance_reference_no),
          is_retained_after_technical_eval:
            data.is_retained_after_technical_eval === null || data.is_retained_after_technical_eval === undefined
              ? ""
              : String(Boolean(data.is_retained_after_technical_eval)),
          refund_status: valueOrBlank(data.refund_status) || "not_due",
          refund_date: valueOrBlank(data.refund_date),
          refund_approval_copy_path: valueOrBlank(data.refund_approval_copy_path),
          refund_receiving_copy_path: valueOrBlank(data.refund_receiving_copy_path),
          received_by_name: valueOrBlank(data.received_by_name),
          received_by_designation: valueOrBlank(data.received_by_designation),
          remarks: valueOrBlank(data.remarks),
        });
      } catch (error) {
        setPopup({
          open: true,
          type: "error",
          message: error.message || "Unable to fetch EMD record.",
        });
      } finally {
        setLoading(false);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [id]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const requiredFields = [];
    if (["submitted", "transferred_to_hartron"].includes(form.emd_submission_status)) {
      requiredFields.push({ name: "submission_mode", label: "Submission Mode" });
    }
    if (["dd", "cheque"].includes(form.submission_mode)) {
      requiredFields.push(
        { name: "instrument_no", label: "DD / Cheque No." },
        { name: "issuing_bank_name", label: "Issuing Bank" },
      );
    }
    if (form.submission_mode === "rtgs") {
      requiredFields.push({ name: "utr_no", label: "UTR No." });
    }
    if (form.submission_mode === "bg") {
      requiredFields.push(
        { name: "bg_no", label: "BG No." },
        { name: "bg_valid_upto", label: "BG Valid Upto" },
        { name: "bg_claim_period_upto", label: "BG Claim Period Upto" },
      );
    }

    const validationErrors = buildRequiredErrors(form, requiredFields);
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    setSaving(true);

    try {
      await patchProcurement(`/emd/${id}`, {
        ...form,
        is_retained_after_technical_eval:
          form.is_retained_after_technical_eval === ""
            ? null
            : form.is_retained_after_technical_eval === "true",
      });
      setPopup({
        open: true,
        type: "success",
        message: "EMD details updated successfully.",
        moveTo: backTo,
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to update EMD details.",
      });
    } finally {
      setSaving(false);
    }
  };

  const refundAdvisory = entry?.refund_advisory || null;
  const showExemptionFields = form.emd_submission_status === "exempted";
  const showInstrumentSection = ["submitted", "transferred_to_hartron"].includes(
    form.emd_submission_status,
  );
  const showInstrumentNoFields = ["dd", "cheque"].includes(form.submission_mode);
  const showRtgsFields = form.submission_mode === "rtgs";
  const showBgFields = form.submission_mode === "bg";
  const showCashFields = form.submission_mode === "cash";
  const showRefundSection =
    Boolean(refundAdvisory?.should_show_refund_fields) ||
    form.refund_status !== "not_due" ||
    Boolean(form.refund_date) ||
    Boolean(form.refund_approval_copy_path) ||
    Boolean(form.refund_receiving_copy_path) ||
    Boolean(form.received_by_name) ||
    Boolean(form.received_by_designation);

  return (
    <div className="min-h-full bg-[#f5f5f7] px-4 py-7 text-[#1d1d1f]">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
          <div className="border-b border-white/10 px-6 py-4">
          <Link to={backTo} state={backState} className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          </div>
          <div className="px-6 py-6 md:px-8 md:py-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">Update EMD</p>
          <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">Edit EMD Details</h1>
          <p className="mt-2 text-sm leading-6 text-white/70 md:text-[15px]">
            {entry?.tender_vendor?.firm?.firm_name || "Firm"} | {entry?.tender?.tender_reference_no || "Tender"}
          </p>
          </div>
        </div>

        <Card className="border-0 shadow-xl">
          <CardContent>
            {loading ? (
              <div className="grid min-h-80 place-items-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-700" />
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                {refundAdvisory?.is_due ? (
                  <div
                    className={`rounded-2xl border px-4 py-4 text-sm ${
                      refundAdvisory.is_overdue
                        ? "border-rose-200 bg-rose-50 text-rose-900"
                        : "border-amber-200 bg-amber-50 text-amber-900"
                    }`}
                  >
                    <p className="font-semibold">
                      {refundAdvisory.is_overdue
                        ? "EMD refund alert: this refund is overdue."
                        : "EMD refund is due under GFR timeline."}
                    </p>
                    <p className="mt-1">
                      {refundAdvisory.refund_reason} Refund should be completed within 15 days.
                    </p>
                    <p className="mt-1">
                      Trigger date: {formatDateOnly(refundAdvisory.trigger_date)} | Due date:{" "}
                      {formatDateOnly(refundAdvisory.due_date)}
                    </p>
                  </div>
                ) : null}

                <section className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Status</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="EMD Status">
                      <Select value={form.emd_submission_status} onChange={update("emd_submission_status")}>
                        <option value="not_submitted">Not Submitted</option>
                        <option value="submitted">Submitted</option>
                        <option value="exempted">Exempted</option>
                        <option value="transferred_to_hartron">Transferred to HARTRON</option>
                      </Select>
                    </Field>
                    <Field label="Retained After Technical Evaluation">
                      <Select value={form.is_retained_after_technical_eval} onChange={update("is_retained_after_technical_eval")}>
                        <option value="">Not Decided</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </Select>
                    </Field>
                    {showExemptionFields ? (
                      <>
                        <Field label="Exemption">
                          <Select value={form.emd_exemption_status} onChange={update("emd_exemption_status")}>
                            <option value="none">No Exemption</option>
                            <option value="full">Full Exemption</option>
                          </Select>
                        </Field>
                        <Field label="Exemption Reason">
                          <Input value={form.emd_exemption_reason} onChange={update("emd_exemption_reason")} />
                        </Field>
                      </>
                    ) : null}
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Instrument</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="EMD Amount">
                      <Input type="number" min="0" value={form.emd_amount} onChange={update("emd_amount")} />
                    </Field>
                    <Field label="Tender Fee Amount">
                      <Input type="number" min="0" value={form.tender_fee_amount} onChange={update("tender_fee_amount")} />
                    </Field>
                    <Field label="Finance Reference No.">
                      <Input value={form.finance_reference_no} onChange={update("finance_reference_no")} />
                    </Field>
                    {showInstrumentSection ? (
                      <Field label="Submission Mode">
                        <Select value={form.submission_mode} onChange={update("submission_mode")} error={errors.submission_mode}>
                          <option value="">Select Mode</option>
                          <option value="nic_portal">NIC Portal</option>
                          <option value="dd">Demand Draft</option>
                          <option value="cheque">Cheque</option>
                          <option value="rtgs">RTGS</option>
                          <option value="bg">Bank Guarantee</option>
                          <option value="cash">Cash</option>
                        </Select>
                        <FieldError message={errors.submission_mode} />
                      </Field>
                    ) : null}
                    {showInstrumentNoFields ? (
                      <>
                        <Field label="DD / Cheque No.">
                          <Input
                            value={form.instrument_no}
                            onChange={update("instrument_no")}
                            aria-invalid={Boolean(errors.instrument_no)}
                            className={invalidControlClass(errors.instrument_no)}
                          />
                          <FieldError message={errors.instrument_no} />
                        </Field>
                        <Field label="Issuing Bank">
                          <Input
                            value={form.issuing_bank_name}
                            onChange={update("issuing_bank_name")}
                            aria-invalid={Boolean(errors.issuing_bank_name)}
                            className={invalidControlClass(errors.issuing_bank_name)}
                          />
                          <FieldError message={errors.issuing_bank_name} />
                        </Field>
                      </>
                    ) : null}
                    {showRtgsFields ? (
                      <Field label="UTR No.">
                        <Input
                          value={form.utr_no}
                          onChange={update("utr_no")}
                          aria-invalid={Boolean(errors.utr_no)}
                          className={invalidControlClass(errors.utr_no)}
                        />
                        <FieldError message={errors.utr_no} />
                      </Field>
                    ) : null}
                    {showBgFields ? (
                      <>
                        <Field label="BG No.">
                          <Input
                            value={form.bg_no}
                            onChange={update("bg_no")}
                            aria-invalid={Boolean(errors.bg_no)}
                            className={invalidControlClass(errors.bg_no)}
                          />
                          <FieldError message={errors.bg_no} />
                        </Field>
                        <Field label="Issuing Bank">
                          <Input
                            value={form.issuing_bank_name}
                            onChange={update("issuing_bank_name")}
                            aria-invalid={Boolean(errors.issuing_bank_name)}
                            className={invalidControlClass(errors.issuing_bank_name)}
                          />
                          <FieldError message={errors.issuing_bank_name} />
                        </Field>
                        <Field label="BG Valid Upto">
                          <Input
                            type="date"
                            value={form.bg_valid_upto}
                            onChange={update("bg_valid_upto")}
                            aria-invalid={Boolean(errors.bg_valid_upto)}
                            className={invalidControlClass(errors.bg_valid_upto)}
                          />
                          <FieldError message={errors.bg_valid_upto} />
                        </Field>
                        <Field label="BG Claim Period Upto">
                          <Input
                            type="date"
                            value={form.bg_claim_period_upto}
                            onChange={update("bg_claim_period_upto")}
                            aria-invalid={Boolean(errors.bg_claim_period_upto)}
                            className={invalidControlClass(errors.bg_claim_period_upto)}
                          />
                          <FieldError message={errors.bg_claim_period_upto} />
                        </Field>
                      </>
                    ) : null}
                    {showCashFields ? (
                      <Field label="Deposit Date">
                        <Input type="date" value={form.deposit_date} onChange={update("deposit_date")} />
                      </Field>
                    ) : null}
                    {showInstrumentSection ? (
                      <div className="md:col-span-2">
                        <FileAttachmentField
                          label="DD / BG / EMD Copy"
                          storedPath={form.submission_document_path}
                          onChange={(value) =>
                            setForm((current) => ({
                              ...current,
                              submission_document_path: value,
                            }))
                          }
                          onUpload={(file) =>
                            uploadEmdFile("emd_submission_document", file)
                          }
                          helperText="Upload the DD, BG, portal acknowledgement, or other submitted EMD copy."
                        />
                      </div>
                    ) : null}
                  </div>
                </section>

                {showRefundSection ? (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Refund</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Refund Status">
                      <Select value={form.refund_status} onChange={update("refund_status")}>
                        <option value="not_due">Not Due</option>
                        <option value="pending">Pending</option>
                        <option value="refunded">Refunded</option>
                        <option value="forfeited">Forfeited</option>
                      </Select>
                    </Field>
                    <Field label="Refund Date">
                      <Input type="date" value={form.refund_date} onChange={update("refund_date")} />
                    </Field>
                    <div className="md:col-span-2">
                      <FileAttachmentField
                        label="Refund Approval Copy"
                        storedPath={form.refund_approval_copy_path}
                        onChange={(value) =>
                          setForm((current) => ({ ...current, refund_approval_copy_path: value }))
                        }
                        onUpload={(file) => uploadEmdFile("emd_refund_approval", file)}
                        helperText="Upload the approval copy used for EMD refund."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <FileAttachmentField
                        label="Refund Receiving Copy"
                        storedPath={form.refund_receiving_copy_path}
                        onChange={(value) =>
                          setForm((current) => ({ ...current, refund_receiving_copy_path: value }))
                        }
                        onUpload={(file) => uploadEmdFile("emd_refund_receiving", file)}
                        helperText="Upload the vendor receiving acknowledgement copy."
                      />
                    </div>
                    <Field label="Received By">
                      <Input value={form.received_by_name} onChange={update("received_by_name")} />
                    </Field>
                    <Field label="Receiver Designation">
                      <Input value={form.received_by_designation} onChange={update("received_by_designation")} />
                    </Field>
                  </div>
                  <Field label="Remarks">
                    <textarea
                      className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      value={form.remarks}
                      onChange={update("remarks")}
                    />
                  </Field>
                </section>
                ) : null}

                <Button className="w-full bg-blue-700 py-5 text-white hover:bg-blue-800" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />}
                  Save EMD Changes
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        moveTo={popup.moveTo}
        moveState={backState}
        onClose={() => setPopup({ open: false, type: "info", message: "", moveTo: "" })}
      />
    </div>
  );
}
