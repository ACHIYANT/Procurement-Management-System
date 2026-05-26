import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  FileSpreadsheet,
  Gavel,
  PackageCheck,
} from "lucide-react";

import AppLoader from "@/components/AppLoader";
import ListTable from "@/components/ListTable";
import PopupMessage from "@/components/PopupMessage";
import { Card, CardContent } from "@/components/ui/card";
import { formatCompactIndianAmount, formatCurrencyINR } from "@/lib/amount-format";
import { procurementRequest } from "@/lib/procurement-api";

const AUTO_REFRESH_MS = 60 * 1000;

const numberFormat = (value) => new Intl.NumberFormat("en-IN").format(Number(value || 0));
const money = (value) => formatCurrencyINR(value);
const compactMoney = (value) => formatCompactIndianAmount(value);

const label = (value) =>
  String(value || "NA")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function KpiCard({ icon: Icon, label: title, value, helper, tone = "blue" }) {
  const toneMap = {
    blue: "bg-[#f7fbff] text-[#1d1d1f]",
    cyan: "bg-[#f7fbff] text-[#1d1d1f]",
    emerald: "bg-[#f7fbff] text-[#1d1d1f]",
    amber: "bg-[#fffaf2] text-[#1d1d1f]",
    rose: "bg-[#fff6f6] text-[#1d1d1f]",
    slate: "bg-white text-[#1d1d1f]",
  };

  return (
    <Card className={`border-0 shadow-[0_18px_40px_-34px_rgba(0,0,0,0.45)] ring-1 ring-black/8 ${toneMap[tone] || toneMap.blue}`}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-black/42">{title}</p>
          <p className="mt-3 text-[2.1rem] font-semibold tracking-[-0.05em]">{value}</p>
          {helper ? <p className="mt-2 text-xs text-black/56">{helper}</p> : null}
        </div>
        <div className="rounded-2xl bg-white p-3 ring-1 ring-black/6">
          <Icon className="h-6 w-6" />
        </div>
      </CardContent>
    </Card>
  );
}

function SectionCard({ title, subtitle, action, children }) {
  return (
    <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[1.4rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-black/56">{subtitle}</p> : null}
          </div>
          {action || null}
        </div>
        <div className="mt-4">{children}</div>
      </CardContent>
    </Card>
  );
}

function AttentionTile({ label: title, value, tone = "slate" }) {
  const toneMap = {
    red: "bg-[#fff6f6] text-[#1d1d1f]",
    amber: "bg-[#fffaf2] text-[#1d1d1f]",
    blue: "bg-[#f7fbff] text-[#1d1d1f]",
    emerald: "bg-[#f6fbf7] text-[#1d1d1f]",
    slate: "bg-[#f5f5f7] text-[#1d1d1f]",
  };

  return (
    <div className={`rounded-[22px] p-4 ring-1 ring-black/6 ${toneMap[tone] || toneMap.slate}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/42">{title}</p>
      <p className="mt-2 text-[2rem] font-semibold tracking-[-0.05em]">{numberFormat(value)}</p>
    </div>
  );
}

export default function Reports() {
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const data = await procurementRequest("/reports");
      setReport(data || {});
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to fetch reports.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
    const timer = window.setInterval(loadReport, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadReport]);

  const departmentRows = useMemo(() => {
    const rows = Array.isArray(report?.department_rows) ? report.department_rows : [];
    if (!search.trim()) return rows;
    const query = search.trim().toLowerCase();
    return rows.filter((row) =>
      [
        row?.department_name,
        row?.indent_count,
        row?.procurement_case_count,
        row?.tender_count,
        row?.purchase_order_count,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [report?.department_rows, search]);

  const departmentColumns = [
    { key: "department_name", label: "Department", sortable: true },
    { key: "indent_count", label: "Indents", sortable: true },
    { key: "procurement_case_count", label: "Cases", sortable: true },
    { key: "tender_count", label: "Tenders", sortable: true },
    { key: "purchase_order_count", label: "POs", sortable: true },
    { key: "indent_estimated_value", label: "Indent Est.", format: compactMoney, sortable: true },
    { key: "purchase_order_value", label: "PO Value", format: compactMoney, sortable: true },
    { key: "fund_inflow", label: "Fund Inflow", format: compactMoney, sortable: true },
    { key: "fund_outflow", label: "Fund Outflow", format: compactMoney, sortable: true },
    { key: "net_balance", label: "Net Balance", format: compactMoney, sortable: true },
    { key: "latest_activity_at", label: "Latest Activity", format: formatDateTime, sortable: true },
  ];

  const indentColumns = [
    { key: "indent_no", label: "Indent No.", sortable: true },
    { key: "department_name", label: "Department", sortable: true },
    { key: "received_date", label: "Received", format: formatDate, sortable: true },
    { key: "status", label: "Status", format: label, sortable: true },
    { key: "total_items", label: "Items", sortable: true },
    { key: "unassigned_items", label: "Unassigned", sortable: true },
    { key: "pending_estimate_items", label: "Pending Estimate", sortable: true },
  ];

  const tenderColumns = [
    { key: "tender_title", label: "Tender", sortable: true },
    { key: "department_name", label: "Department", sortable: true },
    { key: "case_no", label: "Case", sortable: true },
    { key: "portal_type", label: "Portal", format: label, sortable: true },
    { key: "status", label: "Status", format: label, sortable: true },
    { key: "vendor_count", label: "Vendors", sortable: true },
    { key: "emd_issue", label: "EMD Issue", render: (value) => (value ? "Yes" : "No"), sortable: true },
    { key: "pbg_issue", label: "PBG Issue", render: (value) => (value ? "Yes" : "No"), sortable: true },
    { key: "overdue_deadline", label: "Deadline Overdue", render: (value) => (value ? "Yes" : "No"), sortable: true },
    { key: "current_submission_deadline", label: "Submission Deadline", format: formatDateTime, sortable: true },
  ];

  const poColumns = [
    { key: "po_no", label: "PO No.", sortable: true },
    { key: "department_name", label: "Department", sortable: true },
    { key: "firm_name", label: "Firm", sortable: true },
    { key: "case_no", label: "Case", sortable: true },
    { key: "po_date", label: "PO Date", format: formatDate, sortable: true },
    { key: "po_value", label: "PO Value", format: money, sortable: true },
    { key: "total_paid_amount", label: "Paid", format: money, sortable: true },
    { key: "pending_amount", label: "Pending", format: money, sortable: true },
    { key: "paid_percentage", label: "Paid %", render: (value) => `${Number(value || 0).toFixed(2)}%`, sortable: true },
    { key: "latest_payment_date", label: "Latest Payment", format: formatDateTime, sortable: true },
  ];

  const lifecycleColumns = [
    { key: "department_name", label: "Department", sortable: true },
    { key: "indent_no", label: "Indent No.", sortable: true },
    { key: "indent_received_date", label: "Indent Received", format: formatDate, sortable: true },
    { key: "case_no", label: "Case No.", sortable: true },
    { key: "tender_title", label: "Tender", sortable: true },
    { key: "tender_portal", label: "Portal", format: label, sortable: true },
    { key: "bid_publish_date", label: "Tender Publish", format: formatDate, sortable: true },
    { key: "current_submission_deadline", label: "Deadline", format: formatDateTime, sortable: true },
    { key: "meeting_count", label: "Meetings", sortable: true },
    { key: "meeting_types", label: "Meeting Types", sortable: true },
    { key: "latest_meeting_date", label: "Latest Meeting", format: formatDate, sortable: true },
    { key: "purchase_order_count", label: "PO Count", sortable: true },
    { key: "purchase_order_numbers", label: "PO Numbers", sortable: true },
    { key: "latest_po_date", label: "Latest PO", format: formatDate, sortable: true },
    { key: "total_po_value", label: "PO Value", format: compactMoney, sortable: true },
    { key: "payment_entry_count", label: "Payments", sortable: true },
    { key: "latest_payment_date", label: "Latest Payment", format: formatDate, sortable: true },
    { key: "total_paid_value", label: "Paid", format: compactMoney, sortable: true },
    { key: "payment_pending_value", label: "Pending", format: compactMoney, sortable: true },
  ];

  if (loading && !report) {
    return (
      <div className="min-h-full bg-transparent px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-7xl rounded-3xl bg-white/70 shadow-lg ring-1 ring-slate-200/70">
          <AppLoader message="Loading reports..." minHeightClass="min-h-[28rem]" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-full bg-transparent px-4 py-7 text-[#1d1d1f]">
        <div className="mx-auto max-w-[1500px] space-y-5">
          <div className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
            <div className="flex flex-col gap-4 px-6 py-6 md:px-8 md:py-7 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">
                  Procurement Management System
                </p>
                <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">Reports</h1>
                <p className="mt-1 text-sm leading-6 text-white/70 md:text-[15px]">
                  Department-wise and workflow-wise reporting based on live PMS records, department funds, and vendor payments.
                </p>
                <p className="mt-2 text-xs text-white/40">
                  Generated at {formatDateTime(report?.generated_at)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/reconciliation"
                  className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/14"
                >
                  Reconciliation
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/department-funds"
                  className="inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0066cc]"
                >
                  Department Funds
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={Building2}
              label="Departments"
              value={numberFormat(departmentRows.length)}
              helper="Departments visible in live PMS and finance history."
              tone="cyan"
            />
            <KpiCard
              icon={ClipboardList}
              label="Indents"
              value={numberFormat(report?.overview?.total_indents)}
              helper={`${compactMoney(report?.value_flow?.indent_estimated_value)} estimated across indent items.`}
              tone="blue"
            />
            <KpiCard
              icon={BriefcaseBusiness}
              label="Procurement Cases"
              value={numberFormat(report?.overview?.total_procurement_cases)}
              helper={`${compactMoney(report?.value_flow?.procurement_case_estimated_value)} estimated at case level.`}
              tone="emerald"
            />
            <KpiCard
              icon={Gavel}
              label="Tenders"
              value={numberFormat(report?.overview?.total_tenders)}
              helper={`${compactMoney(report?.value_flow?.tender_value)} tendered value recorded.`}
              tone="amber"
            />
            <KpiCard
              icon={PackageCheck}
              label="Purchase Orders"
              value={numberFormat(report?.overview?.total_purchase_orders)}
              helper={`${compactMoney(report?.value_flow?.purchase_order_value)} PO value recorded.`}
              tone="blue"
            />
            <KpiCard
              icon={Banknote}
              label="Fund Balance"
              value={compactMoney(report?.value_flow?.department_fund_balance)}
              helper={`${compactMoney(report?.value_flow?.department_fund_inflow)} inflow vs ${compactMoney(report?.value_flow?.department_fund_outflow)} outflow.`}
              tone="emerald"
            />
            <KpiCard
              icon={FileSpreadsheet}
              label="Vendor Payments"
              value={compactMoney(report?.value_flow?.vendor_payment_outflow)}
              helper="Live vendor payments recorded against POs."
              tone="cyan"
            />
            <KpiCard
              icon={AlertTriangle}
              label="Action Required"
              value={numberFormat(report?.action_required_count)}
              helper="Pending assignment, estimation, tender, and payment items."
              tone="rose"
            />
          </div>

          <SectionCard
            title="Flow Health"
            subtitle="Current operational pressure points across indent, tender, and PO stages."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AttentionTile label="Pending Assignment" value={report?.flow_health?.indents_pending_assignment} tone="red" />
              <AttentionTile label="Pending Estimate" value={report?.flow_health?.indents_pending_estimate} tone="amber" />
              <AttentionTile label="Cases Without Tender" value={report?.flow_health?.procurement_cases_without_tender} tone="blue" />
              <AttentionTile label="Tenders Without Vendors" value={report?.flow_health?.tenders_without_vendors} tone="blue" />
              <AttentionTile label="Tenders With EMD Issue" value={report?.flow_health?.tenders_with_emd_issue} tone="red" />
              <AttentionTile label="Tenders With PBG Issue" value={report?.flow_health?.tenders_with_pbg_issue} tone="amber" />
              <AttentionTile label="Overdue Submission" value={report?.flow_health?.overdue_submission_deadlines} tone="red" />
              <AttentionTile label="POs Pending Payment" value={report?.flow_health?.purchase_orders_pending_payment} tone="emerald" />
            </div>
          </SectionCard>

          <SectionCard
            title="Department-Wise Reconciliation Snapshot"
            subtitle="Operational volume and finance movement grouped department-wise."
            action={
              <label className="relative block w-full sm:w-80">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search department..."
                  className="h-10 w-full rounded-full border border-black/10 bg-[#f5f5f7] px-3 pr-3 text-sm outline-none transition focus:border-[#0071e3] focus:bg-white focus:ring-2 focus:ring-[#0071e3]/12"
                />
              </label>
            }
          >
            <ListTable
              columns={departmentColumns}
              data={departmentRows}
              idCol="department_name"
              onRowClick={(departmentName) => navigate(`/reconciliation/${encodeURIComponent(departmentName)}`)}
              getRowClassName={(row) =>
                Number(row?.net_balance || 0) !== 0
                  ? "bg-white border-l-4 border-amber-400"
                  : "bg-white border-l-4 border-emerald-400"
              }
            />
          </SectionCard>

          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard
              title="Pending Indent Work"
              subtitle="Indents where assignment or estimation is still pending."
            >
              <ListTable
                columns={indentColumns}
                data={Array.isArray(report?.pending_indent_work) ? report.pending_indent_work : []}
                idCol="id"
                onRowClick={(id) => navigate(`/indents/${id}`)}
                getRowClassName={() => "bg-white border-l-4 border-rose-300"}
              />
            </SectionCard>

            <SectionCard
              title="Tender Attention"
              subtitle="Tenders needing vendor, EMD, PBG, or deadline review."
            >
              <ListTable
                columns={tenderColumns}
                data={Array.isArray(report?.tender_attention) ? report.tender_attention : []}
                idCol="id"
                onRowClick={(id) => navigate(`/tenders/${id}`)}
                getRowClassName={(row) =>
                  row?.overdue_deadline
                    ? "bg-white border-l-4 border-rose-400"
                    : row?.emd_issue || row?.pbg_issue
                      ? "bg-white border-l-4 border-amber-400"
                      : "bg-white border-l-4 border-blue-300"
                }
              />
            </SectionCard>
          </div>

          <SectionCard
            title="PO Payment Position"
            subtitle="Purchase orders where vendor payment is still pending."
          >
            <ListTable
              columns={poColumns}
              data={Array.isArray(report?.purchase_order_payment_position) ? report.purchase_order_payment_position : []}
              idCol="id"
              onRowClick={(id) => navigate(`/purchase-orders/${id}`)}
              getRowClassName={() => "bg-white border-l-4 border-cyan-400"}
            />
          </SectionCard>

          <SectionCard
            title="Tender Complete Cycle"
            subtitle="End-to-end tender trail from indent receipt through meetings, purchase orders, and vendor payments."
          >
            <ListTable
              columns={lifecycleColumns}
              data={Array.isArray(report?.tender_lifecycle_rows) ? report.tender_lifecycle_rows : []}
              idCol="id"
              onRowClick={(id) => navigate(`/tenders/${id}`)}
              getRowClassName={(row) =>
                Number(row?.payment_pending_value || 0) > 0
                  ? "bg-white border-l-4 border-amber-400"
                  : Number(row?.payment_entry_count || 0) > 0
                    ? "bg-white border-l-4 border-emerald-400"
                    : "bg-white border-l-4 border-blue-300"
              }
            />
          </SectionCard>
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
