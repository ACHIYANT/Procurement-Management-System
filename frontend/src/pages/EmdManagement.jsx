import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { ArrowLeft, Loader2, PlusCircle, ShieldCheck } from "lucide-react";

import FieldError from "@/components/FieldError";
import FileAttachmentField from "@/components/FileAttachmentField";
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
  firm_name: "",
  firm_code: "",
  vendor_type: "",
  msme_no: "",
  msme_state: "",
  tender_reference_no: "",
  portal_type: "gem",
  tender_title: "",
  portal_bid_no: "",
  portal_ra_no: "",
  portal_tender_id: "",
  tender_value: "",
  emd_amount: "",
  tender_fee_amount: "",
  bid_publish_date: "",
  bid_submission_date: "",
  location_scope: "PANCHKULA",
  participation_status: "participated",
  technical_status: "pending",
  commercial_status: "pending",
  emd_submission_status: "not_submitted",
  emd_exemption_status: "none",
  emd_exemption_reason: "",
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
  refund_status: "not_due",
  refund_date: "",
  received_by_name: "",
  received_by_designation: "",
  remarks: "",
};

const portalOptions = [
  ["gem", "GeM"],
  ["nic", "NIC e-Procurement"],
  ["empanelled", "Empanelled Vendor"],
  ["direct_market", "Direct Market"],
  ["known_vendor", "Known Vendor"],
];

const emdStatusOptions = [
  ["not_submitted", "Not Submitted"],
  ["submitted", "Submitted"],
  ["exempted", "Exempted"],
  ["transferred_to_hartron", "Transferred to HARTRON"],
];

const submissionModes = [
  ["", "Select submission mode"],
  ["nic_portal", "NIC Portal"],
  ["dd", "Demand Draft"],
  ["cheque", "Cheque"],
  ["rtgs", "RTGS"],
  ["bg", "Bank Guarantee"],
  ["cash", "Cash"],
];

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

export default function EmdManagement() {
  const [form, setForm] = useState(initialForm);
  const [entries, setEntries] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    clearFieldError(setErrors, field);
  };

  const uploadEmdFile = async (scope, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadProcurementFile(`/files/upload/${scope}`, formData);
  };

  const showPopup = (type, message) => setPopup({ open: true, type, message });

  const loadEntries = async () => {
    try {
      setPageLoading(true);
      const data = await procurementRequest("/emd");
      setEntries(Array.isArray(data) ? data : []);
    } catch (error) {
      showPopup("error", error.message || "Unable to load EMD entries.");
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadEntries();
    }, 0);

    return () => clearTimeout(timer);
    // The initial fetch is intentionally one-shot; submit refreshes explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const requiredFields = [
      { name: "firm_name", label: "Firm Name" },
      { name: "tender_reference_no", label: "Tender / Bid Reference No." },
      { name: "tender_title", label: "Tender Title" },
      { name: "location_scope", label: "Location Scope" },
    ];

    if (form.emd_submission_status === "submitted") {
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

    setLoading(true);

    try {
      await postProcurement("/emd/workflows", {
        firm: {
          firm_name: form.firm_name,
          firm_code: form.firm_code,
          vendor_type: form.vendor_type,
          msme_no: form.msme_no,
          msme_state: form.msme_state,
        },
        tender: {
          tender_reference_no: form.tender_reference_no,
          portal_type: form.portal_type,
          tender_title: form.tender_title,
          portal_bid_no: form.portal_bid_no,
          portal_ra_no: form.portal_ra_no,
          portal_tender_id: form.portal_tender_id,
          tender_value: form.tender_value,
          emd_amount: form.emd_amount,
          tender_fee_amount: form.tender_fee_amount,
          bid_publish_date: form.bid_publish_date,
          bid_submission_date: form.bid_submission_date,
          location_scope: form.location_scope,
        },
        tender_vendor: {
          participation_status: form.participation_status,
          technical_status: form.technical_status,
          commercial_status: form.commercial_status,
        },
        emd: {
          emd_submission_status: form.emd_submission_status,
          emd_exemption_status: form.emd_exemption_status,
          emd_exemption_reason: form.emd_exemption_reason,
          tender_fee_amount: form.tender_fee_amount,
          emd_amount: form.emd_amount,
          submission_mode: form.submission_mode,
          instrument_no: form.instrument_no,
          issuing_bank_name: form.issuing_bank_name,
          utr_no: form.utr_no,
          bg_no: form.bg_no,
          bg_valid_upto: form.bg_valid_upto,
          bg_claim_period_upto: form.bg_claim_period_upto,
          deposit_date: form.deposit_date,
          submission_document_path: form.submission_document_path,
          finance_reference_no: form.finance_reference_no,
          refund_status: form.refund_status,
          refund_date: form.refund_date,
          received_by_name: form.received_by_name,
          received_by_designation: form.received_by_designation,
          remarks: form.remarks,
        },
      });

      setForm(initialForm);
      setErrors({});
      showPopup("success", "EMD entry saved successfully.");
      await loadEntries();
    } catch (error) {
      showPopup("error", error.message || "Unable to save EMD entry.");
    } finally {
      setLoading(false);
    }
  };

  const submittedCount = entries.filter((entry) => entry.emd_submission_status === "submitted").length;
  const missingCount = entries.filter((entry) => entry.emd_submission_status === "not_submitted").length;

  return (
    <div className="min-h-full bg-transparent px-4 py-7 text-[#1d1d1f]">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
          <div className="border-b border-white/10 px-6 py-4 md:px-8">
            <Link to="/emd" className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to EMD list
            </Link>
          </div>
          <div className="flex flex-col justify-between gap-5 px-6 py-6 md:px-8 md:py-7 xl:flex-row xl:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">Procurement Finance</p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">Add EMD Record</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70 md:text-[15px]">
              Capture tender participation, EMD exemption, payment instrument, finance reference, and refund details in one controlled workflow.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center xl:min-w-[20rem]">
            <div className="rounded-[20px] bg-white/10 px-4 py-3 ring-1 ring-white/10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">Records</p>
              <p className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-white">{entries.length}</p>
            </div>
            <div className="rounded-[20px] bg-white/10 px-4 py-3 ring-1 ring-white/10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">Not Submitted</p>
              <p className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-white">{missingCount}</p>
            </div>
          </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Motion.form
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            onSubmit={handleSubmit}
            noValidate
          >
            <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
              <CardContent className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
                    <PlusCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Quick EMD Entry</h2>
                    <p className="text-sm text-slate-500">Firm, tender, bidder, and EMD data are saved together.</p>
                  </div>
                </div>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Firm</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Firm Name">
                      <Input
                        value={form.firm_name}
                        onChange={update("firm_name")}
                        placeholder="Enter firm name"
                        aria-invalid={Boolean(errors.firm_name)}
                        className={invalidControlClass(errors.firm_name)}
                      />
                      <FieldError message={errors.firm_name} />
                    </Field>
                    <Field label="Firm Code">
                      <Input value={form.firm_code} onChange={update("firm_code")} placeholder="Auto generated if blank" />
                    </Field>
                    <Field label="Vendor Type">
                      <Input value={form.vendor_type} onChange={update("vendor_type")} placeholder="MSME, OEM, Dealer..." />
                    </Field>
                    <Field label="MSME State">
                      <Input value={form.msme_state} onChange={update("msme_state")} placeholder="Haryana, Delhi..." />
                    </Field>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Tender</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Tender / Bid Reference No.">
                      <Input
                        value={form.tender_reference_no}
                        onChange={update("tender_reference_no")}
                        aria-invalid={Boolean(errors.tender_reference_no)}
                        className={invalidControlClass(errors.tender_reference_no)}
                      />
                      <FieldError message={errors.tender_reference_no} />
                    </Field>
                    <Field label="Procurement Mode">
                      <Select value={form.portal_type} onChange={update("portal_type")}>
                        {portalOptions.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Tender Title">
                      <Input
                        value={form.tender_title}
                        onChange={update("tender_title")}
                        aria-invalid={Boolean(errors.tender_title)}
                        className={invalidControlClass(errors.tender_title)}
                      />
                      <FieldError message={errors.tender_title} />
                    </Field>
                    <Field label="Location Scope">
                      <Input
                        value={form.location_scope}
                        readOnly
                        disabled
                        aria-invalid={Boolean(errors.location_scope)}
                        className={invalidControlClass(errors.location_scope)}
                      />
                      <FieldError message={errors.location_scope} />
                    </Field>
                    <Field label="GeM Bid No.">
                      <Input value={form.portal_bid_no} onChange={update("portal_bid_no")} />
                    </Field>
                    <Field label="NIC Tender ID / RA No.">
                      <Input value={form.portal_tender_id} onChange={update("portal_tender_id")} placeholder="Tender ID" />
                    </Field>
                    <Field label="Tender Value">
                      <Input type="number" min="0" value={form.tender_value} onChange={update("tender_value")} />
                    </Field>
                    <Field label="EMD Amount">
                      <Input type="number" min="0" value={form.emd_amount} onChange={update("emd_amount")} />
                    </Field>
                    <Field label="Bid Publish Date">
                      <Input type="date" value={form.bid_publish_date} onChange={update("bid_publish_date")} />
                    </Field>
                    <Field label="Bid Submission Date">
                      <Input type="date" value={form.bid_submission_date} onChange={update("bid_submission_date")} />
                    </Field>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">EMD</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="EMD Status">
                      <Select value={form.emd_submission_status} onChange={update("emd_submission_status")}>
                        {emdStatusOptions.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Exemption">
                      <Select value={form.emd_exemption_status} onChange={update("emd_exemption_status")}>
                        <option value="none">No Exemption</option>
                        <option value="full">Full Exemption</option>
                      </Select>
                    </Field>
                    <Field label="Submission Mode">
                      <Select value={form.submission_mode} onChange={update("submission_mode")} error={errors.submission_mode}>
                        {submissionModes.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                      <FieldError message={errors.submission_mode} />
                    </Field>
                    <Field label="Tender Fee Amount">
                      <Input type="number" min="0" value={form.tender_fee_amount} onChange={update("tender_fee_amount")} />
                    </Field>
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
                    <Field label="UTR No.">
                      <Input
                        value={form.utr_no}
                        onChange={update("utr_no")}
                        aria-invalid={Boolean(errors.utr_no)}
                        className={invalidControlClass(errors.utr_no)}
                      />
                      <FieldError message={errors.utr_no} />
                    </Field>
                    <Field label="BG No.">
                      <Input
                        value={form.bg_no}
                        onChange={update("bg_no")}
                        aria-invalid={Boolean(errors.bg_no)}
                        className={invalidControlClass(errors.bg_no)}
                      />
                      <FieldError message={errors.bg_no} />
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
                        helperText="Upload the DD, BG, portal acknowledgement, or related EMD copy."
                      />
                    </div>
                    <Field label="Finance Reference No.">
                      <Input value={form.finance_reference_no} onChange={update("finance_reference_no")} />
                    </Field>
                    <Field label="Refund Status">
                      <Select value={form.refund_status} onChange={update("refund_status")}>
                        <option value="not_due">Not Due</option>
                        <option value="pending">Pending</option>
                        <option value="refunded">Refunded</option>
                        <option value="forfeited">Forfeited</option>
                      </Select>
                    </Field>
                  </div>
                </section>

                <Button className="w-full bg-blue-700 py-5 text-white hover:bg-blue-800" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : "Save EMD Record"}
                </Button>
              </CardContent>
            </Card>
          </Motion.form>

          <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Recent EMD Records</h2>
                  <p className="text-sm text-slate-500">{submittedCount} submitted entries captured.</p>
                </div>
                <ShieldCheck className="h-7 w-7 text-blue-700" />
              </div>
              <div className="space-y-3">
                {pageLoading ? (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Loading EMD records...</p>
                ) : entries.length ? (
                  entries.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {entry?.tender_vendor?.firm?.firm_name || "Firm not linked"}
                          </p>
                          <p className="text-sm text-slate-500">
                            {entry?.tender?.tender_reference_no || "Tender reference pending"}
                          </p>
                        </div>
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          {entry.emd_submission_status}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <span>Mode: {entry.submission_mode || "NA"}</span>
                        <span>Refund: {entry.refund_status}</span>
                        <span>EMD: {entry.emd_amount || "0.00"}</span>
                        <span>Fee: {entry.tender_fee_amount || "0.00"}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No EMD records yet.</p>
                )}
              </div>
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
    </div>
  );
}
