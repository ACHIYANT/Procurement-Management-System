import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { ArrowLeft, Banknote, Loader2, PlusCircle } from "lucide-react";

import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { postProcurement, procurementRequest } from "@/lib/procurement-api";

const initialForm = {
  firm_name: "",
  firm_code: "",
  vendor_type: "",
  gst_no: "",
  pan_no: "",
  po_no: "",
  po_date: "",
  po_value: "",
  status: "released",
  inspection_status: "pending",
  delivery_status: "pending",
  bill_submission_status: "pending",
  pbg_amount: "",
  pbg_percentage: "",
  submission_mode: "bank_guarantee",
  bank_guarantee_no: "",
  issuing_bank_name: "",
  issue_date: "",
  valid_upto: "",
  claim_period_upto: "",
  refund_status: "held",
  refund_date: "",
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

export default function PbgManagement() {
  const [form, setForm] = useState(initialForm);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const showPopup = (type, message) => setPopup({ open: true, type, message });

  const loadEntries = async () => {
    try {
      setPageLoading(true);
      const data = await procurementRequest("/pbg");
      setEntries(Array.isArray(data) ? data : []);
    } catch (error) {
      showPopup("error", error.message || "Unable to load PBG entries.");
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
    setLoading(true);

    try {
      await postProcurement("/pbg/workflows", {
        firm: {
          firm_name: form.firm_name,
          firm_code: form.firm_code,
          vendor_type: form.vendor_type,
          gst_no: form.gst_no,
          pan_no: form.pan_no,
        },
        purchase_order: {
          po_no: form.po_no,
          po_date: form.po_date,
          po_value: form.po_value,
          status: form.status,
          inspection_status: form.inspection_status,
          delivery_status: form.delivery_status,
          bill_submission_status: form.bill_submission_status,
          remarks: form.remarks,
        },
        pbg: {
          pbg_amount: form.pbg_amount,
          pbg_percentage: form.pbg_percentage,
          submission_mode: form.submission_mode,
          bank_guarantee_no: form.bank_guarantee_no,
          issuing_bank_name: form.issuing_bank_name,
          issue_date: form.issue_date,
          valid_upto: form.valid_upto,
          claim_period_upto: form.claim_period_upto,
          refund_status: form.refund_status,
          refund_date: form.refund_date,
          received_by_name: form.received_by_name,
          received_by_designation: form.received_by_designation,
          remarks: form.remarks,
        },
      });

      setForm(initialForm);
      showPopup("success", "PBG entry saved successfully.");
      await loadEntries();
    } catch (error) {
      showPopup("error", error.message || "Unable to save PBG entry.");
    } finally {
      setLoading(false);
    }
  };

  const activeCount = entries.filter((entry) => entry.status === "active").length;
  const releaseDueCount = entries.filter((entry) => entry.refund_status === "pending").length;

  return (
    <div className="min-h-full bg-transparent px-4 py-7 text-[#1d1d1f]">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
          <div className="border-b border-white/10 px-6 py-4 md:px-8">
            <Link to="/pbg" className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to PBG list
            </Link>
          </div>
          <div className="flex flex-col justify-between gap-5 px-6 py-6 md:px-8 md:py-7 xl:flex-row xl:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">Procurement Finance</p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">Add PBG Record</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70 md:text-[15px]">
              Keep performance bank guarantees tied to purchase orders, with validity, claim period, release, and receiving details.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center xl:min-w-[20rem]">
            <div className="rounded-[20px] bg-white/10 px-4 py-3 ring-1 ring-white/10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">Active PBGs</p>
              <p className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-white">{activeCount}</p>
            </div>
            <div className="rounded-[20px] bg-white/10 px-4 py-3 ring-1 ring-white/10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">Release Pending</p>
              <p className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-white">{releaseDueCount}</p>
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
          >
            <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
              <CardContent className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-cyan-100 p-3 text-cyan-700">
                    <PlusCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Quick PBG Entry</h2>
                    <p className="text-sm text-slate-500">Firm, purchase order, and PBG are saved as one transaction.</p>
                  </div>
                </div>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Firm</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Firm Name">
                      <Input value={form.firm_name} onChange={update("firm_name")} placeholder="Enter firm name" required />
                    </Field>
                    <Field label="Firm Code">
                      <Input value={form.firm_code} onChange={update("firm_code")} placeholder="Auto generated if blank" />
                    </Field>
                    <Field label="Vendor Type">
                      <Input value={form.vendor_type} onChange={update("vendor_type")} placeholder="OEM, Dealer, MSME..." />
                    </Field>
                    <Field label="GST No.">
                      <Input value={form.gst_no} onChange={update("gst_no")} />
                    </Field>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Purchase Order</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="PO No.">
                      <Input value={form.po_no} onChange={update("po_no")} required />
                    </Field>
                    <Field label="PO Date">
                      <Input type="date" value={form.po_date} onChange={update("po_date")} required />
                    </Field>
                    <Field label="PO Value">
                      <Input type="number" min="0" value={form.po_value} onChange={update("po_value")} required />
                    </Field>
                    <Field label="PO Status">
                      <Select value={form.status} onChange={update("status")}>
                        <option value="released">Released</option>
                        <option value="amended">Amended</option>
                        <option value="closed">Closed</option>
                        <option value="cancelled">Cancelled</option>
                      </Select>
                    </Field>
                    <Field label="Inspection Status">
                      <Select value={form.inspection_status} onChange={update("inspection_status")}>
                        <option value="pending">Pending</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                      </Select>
                    </Field>
                    <Field label="Delivery Status">
                      <Select value={form.delivery_status} onChange={update("delivery_status")}>
                        <option value="pending">Pending</option>
                        <option value="partial">Partial</option>
                        <option value="completed">Completed</option>
                      </Select>
                    </Field>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">PBG</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="PBG Amount">
                      <Input type="number" min="0" value={form.pbg_amount} onChange={update("pbg_amount")} required />
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
                    <Field label="Bank Guarantee No.">
                      <Input value={form.bank_guarantee_no} onChange={update("bank_guarantee_no")} />
                    </Field>
                    <Field label="Issuing Bank">
                      <Input value={form.issuing_bank_name} onChange={update("issuing_bank_name")} />
                    </Field>
                    <Field label="Issue Date">
                      <Input type="date" value={form.issue_date} onChange={update("issue_date")} />
                    </Field>
                    <Field label="Valid Upto">
                      <Input type="date" value={form.valid_upto} onChange={update("valid_upto")} />
                    </Field>
                    <Field label="Claim Period Upto">
                      <Input type="date" value={form.claim_period_upto} onChange={update("claim_period_upto")} />
                    </Field>
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
                    <Field label="Received By">
                      <Input value={form.received_by_name} onChange={update("received_by_name")} />
                    </Field>
                    <Field label="Receiver Designation">
                      <Input value={form.received_by_designation} onChange={update("received_by_designation")} />
                    </Field>
                  </div>
                </section>

                <Button className="w-full bg-cyan-700 py-5 text-white hover:bg-cyan-800" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : "Save PBG Record"}
                </Button>
              </CardContent>
            </Card>
          </Motion.form>

          <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Recent PBG Records</h2>
                  <p className="text-sm text-slate-500">PO-wise guarantee tracking.</p>
                </div>
                <Banknote className="h-7 w-7 text-cyan-700" />
              </div>
              <div className="space-y-3">
                {pageLoading ? (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Loading PBG records...</p>
                ) : entries.length ? (
                  entries.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {entry?.firm?.firm_name || "Firm not linked"}
                          </p>
                          <p className="text-sm text-slate-500">
                            PO: {entry?.purchase_order?.po_no || "PO reference pending"}
                          </p>
                        </div>
                        <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                          {entry.status}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <span>PBG: {entry.pbg_amount || "0.00"}</span>
                        <span>Mode: {entry.submission_mode}</span>
                        <span>Valid: {entry.valid_upto || "NA"}</span>
                        <span>Release: {entry.refund_status}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No PBG records yet.</p>
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
