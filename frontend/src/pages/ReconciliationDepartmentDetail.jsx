import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  FileStack,
  Landmark,
  ReceiptIndianRupee,
} from "lucide-react";

import AppLoader from "@/components/AppLoader";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { procurementRequest } from "@/lib/procurement-api";
import {
  getStoredFileName,
  toProcurementFileDownloadUrl,
  toProcurementFileViewUrl,
} from "@/lib/procurement-files";

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });

const formatDate = (value) => {
  if (!value) return "NA";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "NA";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const label = (value) =>
  String(value || "NA")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const joinParts = (parts = []) => parts.filter(Boolean).join(" | ");

export default function ReconciliationDepartmentDetail() {
  const { departmentName: encodedDepartmentName } = useParams();
  const departmentName = decodeURIComponent(encodedDepartmentName || "");

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.set("department_name", departmentName);
        const data = await procurementRequest(`/department-funds?${params.toString()}`);
        setEntries(Array.isArray(data) ? data : []);
      } catch (error) {
        setPopup({
          open: true,
          type: "error",
          message: error.message || "Unable to load department reconciliation history.",
        });
      } finally {
        setLoading(false);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [departmentName]);

  const summary = useMemo(() => {
    return entries.reduce(
      (accumulator, entry) => {
        const amount = Number(entry?.amount || 0);
        accumulator.totalEntries += 1;
        if (entry?.entry_type === "parked") accumulator.parked += amount;
        if (entry?.entry_type === "received") accumulator.received += amount;
        if (entry?.entry_type === "vendor_payment") accumulator.vendorPayments += amount;
        if (entry?.entry_type === "adjusted") accumulator.adjusted += amount;
        if (entry?.entry_type === "refunded") accumulator.refunded += amount;
        if (entry?.entry_type === "carry_forward") accumulator.carryForward += amount;
        return accumulator;
      },
      {
        totalEntries: 0,
        parked: 0,
        received: 0,
        vendorPayments: 0,
        adjusted: 0,
        refunded: 0,
        carryForward: 0,
      },
    );
  }, [entries]);

  const netBalance =
    summary.parked +
    summary.received +
    summary.carryForward -
    summary.vendorPayments -
    summary.adjusted -
    summary.refunded;

  const uniquePmsRecords = useMemo(() => {
    const indents = new Map();
    const tenders = new Map();
    const purchaseOrders = new Map();

    for (const entry of entries) {
      if (entry?.indent?.id && !indents.has(entry.indent.id)) {
        indents.set(entry.indent.id, entry.indent);
      }
      if (entry?.tender?.id && !tenders.has(entry.tender.id)) {
        tenders.set(entry.tender.id, entry.tender);
      }
      if (entry?.purchase_order?.id && !purchaseOrders.has(entry.purchase_order.id)) {
        purchaseOrders.set(entry.purchase_order.id, entry.purchase_order);
      }
    }

    return {
      indents: Array.from(indents.values()).sort((left, right) =>
        String(right?.received_date || "").localeCompare(String(left?.received_date || "")),
      ),
      tenders: Array.from(tenders.values()).sort((left, right) =>
        String(right?.bid_publish_date || "").localeCompare(String(left?.bid_publish_date || "")),
      ),
      purchaseOrders: Array.from(purchaseOrders.values()).sort((left, right) =>
        String(right?.po_date || "").localeCompare(String(left?.po_date || "")),
      ),
    };
  }, [entries]);

  const historyRows = useMemo(() => {
    const rows = [];

    for (const entry of entries) {
      rows.push({
        id: `fund-${entry.id}`,
        date: entry.entry_date,
        category: entry.entry_type === "vendor_payment" ? "Vendor Payment" : "Fund Entry",
        subject:
          entry.entry_type === "vendor_payment"
            ? entry.vendor_name || entry.subject || "Vendor Payment"
            : label(entry.entry_type),
        amount: Number(entry.amount || 0),
        reference: entry.reference_no || "NA",
        detail: joinParts([
          entry.subject,
          entry.vendor_name ? `Vendor ${entry.vendor_name}` : null,
          entry.tender?.tender_reference_no || entry.tender?.tender_title
            ? `Tender ${entry.tender?.tender_reference_no || entry.tender?.tender_title}`
            : null,
          entry.purchase_order?.po_no ? `PO ${entry.purchase_order.po_no}` : null,
          entry.financial_year ? `FY ${entry.financial_year}` : null,
          entry.estimate_reference ? `Estimate ${entry.estimate_reference}` : null,
          entry.entry_origin ? `Origin ${label(entry.entry_origin)}` : null,
        ]),
        remarks: entry.remarks || "NA",
        filePath: entry.payment_noting_path || entry.noting_page_path || "",
      });

      if (entry?.indent?.id) {
        rows.push({
          id: `indent-${entry.id}-${entry.indent.id}`,
          date: entry.indent.received_date || entry.indent.indent_date || entry.entry_date,
          category: "PMS Indent",
          subject: entry.indent.indent_no || `Indent #${entry.indent.id}`,
          amount: null,
          reference: entry.indent.cfms_no || "NA",
          detail: joinParts([
            `Indent date ${formatDate(entry.indent.indent_date)}`,
            `Received ${formatDate(entry.indent.received_date)}`,
            entry.indent.status ? `Status ${label(entry.indent.status)}` : null,
          ]),
          remarks: entry.indent.remarks || "NA",
        });
      }

      if (entry?.tender?.id) {
        rows.push({
          id: `tender-${entry.id}-${entry.tender.id}`,
          date:
            entry.tender.bid_publish_date ||
            entry.tender.bid_submission_date ||
            entry.entry_date,
          category: "PMS Tender",
          subject:
            entry.tender.tender_reference_no ||
            entry.tender.tender_title ||
            `Tender #${entry.tender.id}`,
          amount: Number(entry.tender.tender_value || 0),
          reference: entry.tender.file_no || "NA",
          detail: joinParts([
            entry.tender.portal_type ? label(entry.tender.portal_type) : null,
            entry.tender.bid_publish_date
              ? `Published ${formatDate(entry.tender.bid_publish_date)}`
              : null,
            entry.tender.current_submission_deadline
              ? `Deadline ${formatDate(entry.tender.current_submission_deadline)}`
              : null,
            entry.tender.status ? `Status ${label(entry.tender.status)}` : null,
          ]),
          remarks: entry.tender.remarks || "NA",
        });
      }

      if (entry?.purchase_order?.id) {
        rows.push({
          id: `po-${entry.id}-${entry.purchase_order.id}`,
          date: entry.purchase_order.po_date || entry.entry_date,
          category: "PMS Purchase Order",
          subject: entry.purchase_order.po_no || `PO #${entry.purchase_order.id}`,
          amount: Number(entry.purchase_order.po_value || 0),
          reference: entry.purchase_order.status ? label(entry.purchase_order.status) : "NA",
          detail: joinParts([
            `PO date ${formatDate(entry.purchase_order.po_date)}`,
            entry.purchase_order.delivery_status
              ? `Delivery ${label(entry.purchase_order.delivery_status)}`
              : null,
            entry.purchase_order.bill_submission_status
              ? `Billing ${label(entry.purchase_order.bill_submission_status)}`
              : null,
          ]),
          remarks: entry.purchase_order.remarks || "NA",
        });
      }
    }

    return rows.sort((left, right) => {
      const leftValue = String(left.date || "");
      const rightValue = String(right.date || "");
      return rightValue.localeCompare(leftValue) || String(left.id).localeCompare(String(right.id));
    });
  }, [entries]);

  return (
    <>
      <div className="min-h-full bg-[#f5f5f7] px-4 py-7 text-[#1d1d1f]">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 px-6 py-4">
              <Link
                to="/reconciliation"
                className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Reconciliation
              </Link>
            </div>
            <div className="px-6 py-6 md:px-8 md:py-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">
                    Department History
                  </p>
                  <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">{departmentName || "Department"}</h1>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-white/70 md:text-[15px]">
                    Full funding history for this department, including parked and received funds,
                    deductions, carry forward, and the PMS indents, tenders, and purchase orders
                    linked to those entries.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/72">
                <div>Total fund entries: {summary.totalEntries}</div>
                <div className="mt-1">Net department balance: {money(netBalance)}</div>
              </div>
            </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            {[
              { title: "Parked", value: money(summary.parked), icon: Landmark },
              { title: "Received / Payment", value: money(summary.received), icon: ReceiptIndianRupee },
              {
                title: "Payments to Vendors",
                value: money(summary.vendorPayments),
                icon: ReceiptIndianRupee,
              },
              {
                title: "Deductions / Refunds",
                value: money(summary.adjusted + summary.refunded),
                icon: FileStack,
              },
              {
                title: "Carry Forward",
                value: money(summary.carryForward),
                icon: Building2,
              },
              {
                title: "Net Balance",
                value: money(netBalance),
                icon: ReceiptIndianRupee,
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="border-0 shadow-lg">
                  <CardContent className="space-y-3">
                    <div className="inline-flex rounded-2xl bg-blue-100 p-3 text-blue-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">{card.title}</p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">{card.value}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border-0 shadow-xl">
            <CardContent className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Linked PMS Records</h2>
                <p className="text-sm text-slate-500">
                  PMS records already linked through this department&apos;s fund history.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {[
                  {
                    title: "Indents",
                    value: uniquePmsRecords.indents.length,
                  },
                  {
                    title: "Tenders",
                    value: uniquePmsRecords.tenders.length,
                  },
                  {
                    title: "Purchase Orders",
                    value: uniquePmsRecords.purchaseOrders.length,
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-500">{item.title}</p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl">
            <CardContent className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold">Linked Document Snapshot</h2>
                <p className="text-sm text-slate-500">
                  Quick reference of the department&apos;s linked indents, tenders, and POs.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Indents</p>
                  <div className="mt-2 space-y-2">
                    {uniquePmsRecords.indents.length ? (
                      uniquePmsRecords.indents.map((indent) => (
                        <div
                          key={indent.id}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        >
                          <p className="font-medium text-slate-950">
                            {indent.indent_no || `Indent #${indent.id}`}
                          </p>
                          <p className="mt-1 text-slate-600">
                            Received {formatDate(indent.received_date)} | CFMS {indent.cfms_no || "NA"}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No linked indents yet.</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">Tenders</p>
                  <div className="mt-2 space-y-2">
                    {uniquePmsRecords.tenders.length ? (
                      uniquePmsRecords.tenders.map((tender) => (
                        <div
                          key={tender.id}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        >
                          <p className="font-medium text-slate-950">
                            {tender.tender_reference_no || tender.tender_title || `Tender #${tender.id}`}
                          </p>
                          <p className="mt-1 text-slate-600">
                            {label(tender.portal_type)} | Published {formatDate(tender.bid_publish_date)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No linked tenders yet.</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">Purchase Orders</p>
                  <div className="mt-2 space-y-2">
                    {uniquePmsRecords.purchaseOrders.length ? (
                      uniquePmsRecords.purchaseOrders.map((purchaseOrder) => (
                        <div
                          key={purchaseOrder.id}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        >
                          <p className="font-medium text-slate-950">
                            {purchaseOrder.po_no || `PO #${purchaseOrder.id}`}
                          </p>
                          <p className="mt-1 text-slate-600">
                            PO date {formatDate(purchaseOrder.po_date)} | Value{" "}
                            {money(purchaseOrder.po_value)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No linked purchase orders yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl">
            <CardContent className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Full Department History</h2>
                <p className="text-sm text-slate-500">
                  Complete chronological view of fund entries and linked PMS movement for this
                  department.
                </p>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50">
                  <AppLoader message="Loading department history..." minHeightClass="min-h-[12rem]" />
                </div>
              ) : historyRows.length ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Record</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Reference</th>
                        <th className="px-4 py-3">File</th>
                        <th className="px-4 py-3">Details</th>
                        <th className="px-4 py-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyRows.map((row) => (
                        <tr key={row.id} className="bg-white align-top">
                          <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.date)}</td>
                          <td className="px-4 py-3 font-medium text-slate-700">{row.category}</td>
                          <td className="px-4 py-3 font-medium text-slate-950">{row.subject}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {row.amount === null ? "NA" : money(row.amount)}
                          </td>
                          <td className="px-4 py-3">{row.reference}</td>
                          <td className="px-4 py-3">
                            {row.filePath ? (
                              <div className="flex flex-wrap gap-2 text-xs">
                                <a
                                  href={toProcurementFileViewUrl(row.filePath)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full border border-slate-200 px-2 py-1 text-blue-700 hover:bg-blue-50"
                                >
                                  View
                                </a>
                                <a
                                  href={toProcurementFileDownloadUrl(row.filePath)}
                                  className="rounded-full border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50"
                                  title={getStoredFileName(row.filePath)}
                                >
                                  Download
                                </a>
                              </div>
                            ) : (
                              "NA"
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.detail || "NA"}</td>
                          <td className="px-4 py-3 text-slate-500">{row.remarks || "NA"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                  No reconciliation history is available for this department yet.
                </div>
              )}
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
