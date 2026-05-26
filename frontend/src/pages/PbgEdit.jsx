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
  pbg_amount: "",
  pbg_percentage: "",
  submission_mode: "bank_guarantee",
  status: "active",
  bank_guarantee_no: "",
  issuing_bank_name: "",
  issue_date: "",
  valid_upto: "",
  claim_period_upto: "",
  invocation_upto: "",
  document_path: "",
  refund_status: "held",
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

function Select({ value, onChange, children }) {
  return (
    <select
      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      value={value}
      onChange={onChange}
    >
      {children}
    </select>
  );
}

const valueOrBlank = (value) => (value === null || value === undefined ? "" : String(value));

export default function PbgEdit() {
  const { id } = useParams();
  const location = useLocation();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "", moveTo: "" });
  const backTo = location.state?.returnTo || "/pbg";
  const backLabel = location.state?.returnLabel || "Back to PBG list";
  const backState = location.state?.tenderStep
    ? { tenderStep: location.state.tenderStep }
    : undefined;

  const uploadPbgFile = async (scope, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadProcurementFile(`/files/upload/${scope}`, formData);
  };

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    clearFieldError(setErrors, field);
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await procurementRequest(`/pbg/${id}`);
        setEntry(data);
        setForm({
          pbg_amount: valueOrBlank(data.pbg_amount),
          pbg_percentage: valueOrBlank(data.pbg_percentage),
          submission_mode: valueOrBlank(data.submission_mode) || "bank_guarantee",
          status: valueOrBlank(data.status) || "active",
          bank_guarantee_no: valueOrBlank(data.bank_guarantee_no),
          issuing_bank_name: valueOrBlank(data.issuing_bank_name),
          issue_date: valueOrBlank(data.issue_date),
          valid_upto: valueOrBlank(data.valid_upto),
          claim_period_upto: valueOrBlank(data.claim_period_upto),
          invocation_upto: valueOrBlank(data.invocation_upto),
          document_path: valueOrBlank(data.document_path),
          refund_status: valueOrBlank(data.refund_status) || "held",
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
          message: error.message || "Unable to fetch PBG record.",
        });
      } finally {
        setLoading(false);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [id]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const requiredFields = [{ name: "pbg_amount", label: "PBG Amount" }];
    if (form.submission_mode === "bank_guarantee") {
      requiredFields.push(
        { name: "bank_guarantee_no", label: "Bank Guarantee No." },
        { name: "issuing_bank_name", label: "Issuing Bank" },
        { name: "valid_upto", label: "Valid Upto" },
        { name: "claim_period_upto", label: "Claim Period Upto" },
      );
    }

    const validationErrors = buildRequiredErrors(form, requiredFields);
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    setSaving(true);

    try {
      await patchProcurement(`/pbg/${id}`, form);
      setPopup({
        open: true,
        type: "success",
        message: "PBG details updated successfully.",
        moveTo: backTo,
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to update PBG details.",
      });
    } finally {
      setSaving(false);
    }
  };

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
          <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">Update PBG</p>
          <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">Edit PBG Details</h1>
          <p className="mt-2 text-sm leading-6 text-white/70 md:text-[15px]">
            {entry?.firm?.firm_name || "Firm"} | PO {entry?.purchase_order?.po_no || "NA"}
          </p>
          </div>
        </div>

        <Card className="border-0 shadow-xl">
          <CardContent>
            {loading ? (
              <div className="grid min-h-80 place-items-center">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-700" />
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Guarantee</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="PBG Amount">
                      <Input
                        type="number"
                        min="0"
                        value={form.pbg_amount}
                        onChange={update("pbg_amount")}
                        aria-invalid={Boolean(errors.pbg_amount)}
                        className={invalidControlClass(errors.pbg_amount)}
                      />
                      <FieldError message={errors.pbg_amount} />
                    </Field>
                    <Field label="PBG Percentage">
                      <Input type="number" min="0" max="100" value={form.pbg_percentage} onChange={update("pbg_percentage")} />
                    </Field>
                    <Field label="Submission Mode">
                      <Select value={form.submission_mode} onChange={update("submission_mode")}>
                        <option value="bank_guarantee">Bank Guarantee</option>
                        <option value="dd">Demand Draft</option>
                        <option value="rtgs">RTGS</option>
                        <option value="cash">Cash</option>
                      </Select>
                    </Field>
                    <Field label="PBG Status">
                      <Select value={form.status} onChange={update("status")}>
                        <option value="active">Active</option>
                        <option value="extended">Extended</option>
                        <option value="released">Released</option>
                        <option value="expired">Expired</option>
                        <option value="forfeited">Forfeited</option>
                      </Select>
                    </Field>
                    <Field label="Bank Guarantee No.">
                      <Input
                        value={form.bank_guarantee_no}
                        onChange={update("bank_guarantee_no")}
                        aria-invalid={Boolean(errors.bank_guarantee_no)}
                        className={invalidControlClass(errors.bank_guarantee_no)}
                      />
                      <FieldError message={errors.bank_guarantee_no} />
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
                    <Field label="Issue Date">
                      <Input type="date" value={form.issue_date} onChange={update("issue_date")} />
                    </Field>
                    <Field label="Valid Upto">
                      <Input
                        type="date"
                        value={form.valid_upto}
                        onChange={update("valid_upto")}
                        aria-invalid={Boolean(errors.valid_upto)}
                        className={invalidControlClass(errors.valid_upto)}
                      />
                      <FieldError message={errors.valid_upto} />
                    </Field>
                    <Field label="Claim Period Upto">
                      <Input
                        type="date"
                        value={form.claim_period_upto}
                        onChange={update("claim_period_upto")}
                        aria-invalid={Boolean(errors.claim_period_upto)}
                        className={invalidControlClass(errors.claim_period_upto)}
                      />
                      <FieldError message={errors.claim_period_upto} />
                    </Field>
                    <Field label="Invocation Upto">
                      <Input
                        type="date"
                        value={form.invocation_upto}
                        onChange={update("invocation_upto")}
                      />
                    </Field>
                    <div className="md:col-span-2">
                      <FileAttachmentField
                        label="PBG Document"
                        storedPath={form.document_path}
                        onChange={(value) => setForm((current) => ({ ...current, document_path: value }))}
                        onUpload={(file) => uploadPbgFile("pbg_document", file)}
                        helperText="Upload the submitted PBG document or extension letter."
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Release / Refund</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Release Status">
                      <Select value={form.refund_status} onChange={update("refund_status")}>
                        <option value="held">Held</option>
                        <option value="pending">Pending</option>
                        <option value="released">Released</option>
                        <option value="forfeited">Forfeited</option>
                      </Select>
                    </Field>
                    <Field label="Release Date">
                      <Input type="date" value={form.refund_date} onChange={update("refund_date")} />
                    </Field>
                    <div className="md:col-span-2">
                      <FileAttachmentField
                        label="Release Approval Copy"
                        storedPath={form.refund_approval_copy_path}
                        onChange={(value) =>
                          setForm((current) => ({ ...current, refund_approval_copy_path: value }))
                        }
                        onUpload={(file) => uploadPbgFile("pbg_refund_approval", file)}
                        helperText="Upload the approval copy for PBG release or refund."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <FileAttachmentField
                        label="Release Receiving Copy"
                        storedPath={form.refund_receiving_copy_path}
                        onChange={(value) =>
                          setForm((current) => ({ ...current, refund_receiving_copy_path: value }))
                        }
                        onUpload={(file) => uploadPbgFile("pbg_refund_receiving", file)}
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

                <Button className="w-full bg-cyan-700 py-5 text-white hover:bg-cyan-800" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />}
                  Save PBG Changes
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
