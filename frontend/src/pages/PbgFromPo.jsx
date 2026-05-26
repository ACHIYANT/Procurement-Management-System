import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

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

export default function PbgFromPo() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [purchaseOrder, setPurchaseOrder] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const backTo = location.state?.returnTo || `/purchase-orders/${id}`;
  const backLabel = location.state?.returnLabel || "Back to PO";
  const backState = location.state?.tenderStep
    ? { tenderStep: location.state.tenderStep }
    : undefined;

  const uploadPbgFile = async (scope, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadProcurementFile(`/files/upload/${scope}`, formData);
  };

  const loadPurchaseOrder = useCallback(async () => {
    try {
      setLoading(true);
      setPurchaseOrder(await procurementRequest(`/purchase-orders/${id}`));
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to fetch PO." });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => loadPurchaseOrder(), 0);
    return () => clearTimeout(timer);
  }, [loadPurchaseOrder]);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    clearFieldError(setErrors, field);
  };

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
      await postProcurement(`/purchase-orders/${id}/pbg`, form);
      navigate(backTo, { replace: true, state: backState });
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to save PBG." });
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">PO-linked PBG</p>
          <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">Add PBG</h1>
          <p className="mt-2 text-sm leading-6 text-white/70 md:text-[15px]">
            {loading ? "Loading PO..." : `${purchaseOrder?.po_no} | ${purchaseOrder?.firm?.firm_name}`}
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
              <>
                <div className="mb-4 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm text-slate-500">Required PBG</p>
                    <p className="mt-1 text-xl font-semibold">
                      {Number(purchaseOrder?.pbg_summary?.required_amount || 0).toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm text-slate-500">Already Submitted</p>
                    <p className="mt-1 text-xl font-semibold">
                      {Number(purchaseOrder?.pbg_summary?.submitted_amount || 0).toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className={`rounded-2xl border px-4 py-3 ${Number(purchaseOrder?.pbg_summary?.short_amount || 0) > 0 ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
                    <p className="text-sm text-slate-500">Balance to Cover</p>
                    <p className={`mt-1 text-xl font-semibold ${Number(purchaseOrder?.pbg_summary?.short_amount || 0) > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                      {Number(purchaseOrder?.pbg_summary?.short_amount || 0).toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>
                <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} noValidate>
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
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.submission_mode} onChange={update("submission_mode")}>
                    <option value="bank_guarantee">Bank Guarantee</option>
                    <option value="dd">Demand Draft</option>
                    <option value="rtgs">RTGS</option>
                    <option value="cash">Cash</option>
                  </select>
                  </Field>
                  <Field label="PBG Status">
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.status} onChange={update("status")}>
                    <option value="active">Active</option>
                    <option value="extended">Extended</option>
                    <option value="released">Released</option>
                    <option value="expired">Expired</option>
                    <option value="forfeited">Forfeited</option>
                  </select>
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
                      helperText="Upload the submitted PBG document or covering letter."
                    />
                  </div>
                  <Field label="Release Status">
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.refund_status} onChange={update("refund_status")}>
                    <option value="held">Held</option>
                    <option value="pending">Pending</option>
                    <option value="released">Released</option>
                    <option value="forfeited">Forfeited</option>
                  </select>
                  </Field>
                  <Field label="Remarks">
                    <Input value={form.remarks} onChange={update("remarks")} />
                  </Field>
                  <Button className="md:col-span-2 bg-cyan-700 text-white hover:bg-cyan-800" disabled={saving}>
                    {saving ? "Saving..." : "Save PBG"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
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
