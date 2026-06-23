import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Banknote,
  BriefcaseBusiness,
  FileCheck2,
  FileClock,
  ScrollText,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import AppLoader from "@/components/AppLoader";
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

function KpiCard({ icon: Icon, label: cardLabel, value, tone = "blue", helper }) {
  const toneMap = {
    blue: "bg-[#f7fbff] text-[#1d1d1f]",
    cyan: "bg-[#f7fbff] text-[#1d1d1f]",
    emerald: "bg-[#f6fbf7] text-[#1d1d1f]",
    amber: "bg-[#fffaf2] text-[#1d1d1f]",
    rose: "bg-[#fff6f6] text-[#1d1d1f]",
    slate: "bg-white text-[#1d1d1f]",
  };

  return (
    <Card className={`border-0 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8 ${toneMap[tone] || toneMap.blue}`}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-black/42">{cardLabel}</p>
          <p className="mt-3 text-[2.1rem] font-semibold tracking-[-0.05em]">{numberFormat(value)}</p>
          {helper ? <p className="mt-2 text-xs text-black/56">{helper}</p> : null}
        </div>
        <div className="rounded-2xl bg-white p-3 ring-1 ring-black/6">
          <Icon className="h-6 w-6" />
        </div>
      </CardContent>
    </Card>
  );
}

function AttentionRow({ label: rowLabel, value, tone = "slate", href, helper }) {
  const toneMap = {
    red: "border-rose-200 bg-rose-50 text-rose-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    slate: "border-slate-200 bg-slate-50 text-slate-900",
  };

  const content = (
    <div className={`rounded-[20px] p-4 ring-1 ring-black/6 transition hover:-translate-y-0.5 ${toneMap[tone] || toneMap.slate}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">{rowLabel}</div>
          {helper ? <div className="mt-2 text-xs leading-5 opacity-80">{helper}</div> : null}
        </div>
        <div className="text-2xl font-semibold">{numberFormat(value)}</div>
      </div>
    </div>
  );

  if (!href) return content;
  return (
    <Link to={href} className="block">
      {content}
    </Link>
  );
}

function SectionCard({ title, subtitle, actionLabel, actionHref, children }) {
  return (
    <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[1.4rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-black/56">{subtitle}</p> : null}
          </div>
          {actionLabel && actionHref ? (
            <Link
              to={actionHref}
              className="inline-flex items-center rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
            >
              {actionLabel}
            </Link>
          ) : null}
        </div>
        <div className="mt-4">{children}</div>
      </CardContent>
    </Card>
  );
}

function RecentList({ rows = [], emptyMessage, renderRow }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <div className="rounded-[20px] border border-dashed border-black/12 bg-[#f5f5f7] px-4 py-6 text-sm text-black/56">
        {emptyMessage}
      </div>
    );
  }

  return <div className="space-y-3">{rows.map(renderRow)}</div>;
}

function MiniBarChart({ title, items = [], formatter = numberFormat }) {
  const maxValue = Math.max(...items.map((item) => Number(item.value || 0)), 1);

  return (
    <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
      <CardContent className="p-5">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <div className="mt-5 space-y-4">
          {items.map((item) => {
            const numericValue = Number(item.value || 0);
            const width = numericValue <= 0 ? 0 : (numericValue / maxValue) * 100;
            return (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <span className="text-slate-500">{formatter(item.value)}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${item.gradient || "from-blue-500 to-cyan-500"}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function RingChart({ title, items = [], totalLabel }) {
  const safeItems = items.filter((item) => Number(item.value || 0) > 0);
  const total = safeItems.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const chartItems = safeItems.map((item, index) => {
    const portion = Number(item.value || 0) / Math.max(total, 1);
    const dash = portion * circumference;
    const previousDash = safeItems
      .slice(0, index)
      .reduce(
        (sum, current) =>
          sum +
          (Number(current.value || 0) / Math.max(total, 1)) * circumference,
        0,
      );

    return {
      ...item,
      strokeDasharray: `${dash} ${circumference - dash}`,
      strokeDashoffset: -previousDash,
    };
  });

  return (
    <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
      <CardContent className="p-5">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <div className="mt-5 flex flex-col items-center gap-5 lg:flex-row lg:items-start">
          <div className="relative flex h-40 w-40 items-center justify-center">
            <svg viewBox="0 0 140 140" className="h-40 w-40 -rotate-90">
              <circle cx="70" cy="70" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="14" />
              {chartItems.map((item) => (
                <circle
                  key={item.label}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={item.strokeDasharray}
                  strokeDashoffset={item.strokeDashoffset}
                />
              ))}
            </svg>
            <div className="absolute text-center">
              <div className="text-3xl font-semibold text-slate-950">{numberFormat(total)}</div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{totalLabel}</div>
            </div>
          </div>
          <div className="w-full space-y-3">
            {items.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}
                </div>
                <span className="text-sm font-semibold text-slate-900">{numberFormat(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const data = await procurementRequest("/dashboard");
      setDashboard(data);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Unable to fetch dashboard summary.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let intervalId = null;

    const initialize = async () => {
      await loadDashboard({ silent: false });
      if (!alive) return;

      intervalId = setInterval(() => {
        if (!alive) return;
        loadDashboard({ silent: true });
      }, AUTO_REFRESH_MS);
    };

    initialize();

    return () => {
      alive = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [loadDashboard]);

  const overview = dashboard?.overview || {};
  const indentHealth = dashboard?.indent_health || {};
  const procurementCaseHealth = dashboard?.procurement_case_health || {};
  const tenderAttention = dashboard?.tender_attention || {};
  const emdHealth = dashboard?.emd_health || {};
  const poAndPbgHealth = dashboard?.po_and_pbg_health || {};
  const empanelmentHealth = dashboard?.empanelment_health || {};
  const valueFlow = dashboard?.value_flow || {};
  const recentActivity = dashboard?.recent_activity || {};

  const primaryKpis = useMemo(
    () => [
      {
        label: "Total Indents",
        value: overview.indents,
        helper: `${numberFormat(indentHealth.active_indents)} active inward files in pipeline`,
        icon: ScrollText,
        tone: "blue",
      },
      {
        label: "Procurement Cases",
        value: overview.procurement_cases,
        helper: `${numberFormat(procurementCaseHealth.tender_mode_cases_without_tender)} tender-mode cases not yet tendered`,
        icon: BriefcaseBusiness,
        tone: "cyan",
      },
      {
        label: "Tenders",
        value: overview.tenders,
        helper: `${numberFormat(tenderAttention.with_issue)} tenders need operational attention`,
        icon: FileClock,
        tone: "amber",
      },
      {
        label: "Purchase Orders",
        value: overview.purchase_orders,
        helper: `${numberFormat(poAndPbgHealth.purchase_orders_without_pbg)} POs still without PBG`,
        icon: FileCheck2,
        tone: "emerald",
      },
      {
        label: "EMD Records",
        value: overview.emd_entries,
        helper: `${numberFormat(emdHealth.pending_refunds)} refunds pending`,
        icon: WalletCards,
        tone: "slate",
      },
      {
        label: "PBG Records",
        value: overview.pbg_entries,
        helper: `${numberFormat(poAndPbgHealth.pbg_release_pending)} held or pending release`,
        icon: Banknote,
        tone: "rose",
      },
      {
        label: "Empanelments",
        value: overview.empanelments,
        helper: `${numberFormat(empanelmentHealth.expiring_in_30_days)} expiring in next 30 days`,
        icon: ShieldCheck,
        tone: "blue",
      },
    ],
    [
      emdHealth.pending_refunds,
      empanelmentHealth.expiring_in_30_days,
      indentHealth.active_indents,
      overview,
      poAndPbgHealth,
      procurementCaseHealth.tender_mode_cases_without_tender,
      tenderAttention.with_issue,
    ],
  );

  const pipelineGraph = useMemo(
    () => [
      { label: "Indents", value: overview.indents, gradient: "from-blue-600 to-cyan-500" },
      { label: "Cases", value: overview.procurement_cases, gradient: "from-cyan-600 to-sky-500" },
      { label: "Tenders", value: overview.tenders, gradient: "from-amber-500 to-orange-500" },
      { label: "POs", value: overview.purchase_orders, gradient: "from-emerald-500 to-green-500" },
      { label: "EMD", value: overview.emd_entries, gradient: "from-slate-500 to-slate-700" },
      { label: "PBG", value: overview.pbg_entries, gradient: "from-rose-500 to-pink-600" },
    ],
    [overview],
  );

  const attentionGraph = useMemo(
    () => [
      { label: "Unassigned Items", value: indentHealth.unassigned_items, color: "#ef4444" },
      { label: "No Estimate", value: indentHealth.items_without_estimate, color: "#f59e0b" },
      { label: "Tender Issues", value: tenderAttention.with_issue, color: "#f97316" },
      { label: "EMD Refund Pending", value: emdHealth.pending_refunds, color: "#3b82f6" },
      { label: "PO Without PBG", value: poAndPbgHealth.purchase_orders_without_pbg, color: "#8b5cf6" },
      { label: "Empanelment Expiring", value: empanelmentHealth.expiring_in_30_days, color: "#10b981" },
    ],
    [emdHealth.pending_refunds, empanelmentHealth.expiring_in_30_days, indentHealth.items_without_estimate, indentHealth.unassigned_items, poAndPbgHealth.purchase_orders_without_pbg, tenderAttention.with_issue],
  );

  const financialSecurityGraph = useMemo(
    () => [
      { label: "EMD Not Submitted", value: emdHealth.not_submitted, gradient: "from-rose-500 to-rose-600" },
      { label: "EMD Pending Refund", value: emdHealth.pending_refunds, gradient: "from-amber-500 to-orange-500" },
      { label: "POs Without PBG", value: poAndPbgHealth.purchase_orders_without_pbg, gradient: "from-violet-500 to-fuchsia-500" },
      { label: "PBG Expiring 30D", value: poAndPbgHealth.pbg_validity_expiring_in_30_days, gradient: "from-cyan-500 to-blue-500" },
      { label: "PBG Claim Expiring", value: poAndPbgHealth.pbg_claim_period_expiring_in_30_days, gradient: "from-emerald-500 to-green-500" },
    ],
    [emdHealth.not_submitted, emdHealth.pending_refunds, poAndPbgHealth.pbg_claim_period_expiring_in_30_days, poAndPbgHealth.pbg_validity_expiring_in_30_days, poAndPbgHealth.purchase_orders_without_pbg],
  );

  const valueKpis = useMemo(
    () => [
      {
        label: "Indent Estimate Value",
        value: valueFlow.indent_estimated_amount,
        helper: "Total item-wise estimate recorded on inward indent lines",
      },
      {
        label: "Tender Value",
        value: valueFlow.tender_value,
        helper: "Total tendered procurement value currently recorded in PMS",
      },
      {
        label: "PO Value",
        value: valueFlow.purchase_order_value,
        helper: "Total value released through purchase orders",
      },
      {
        label: "PBG Value",
        value: valueFlow.pbg_recorded_value,
        helper: "Total performance security recorded against POs",
      },
    ],
    [valueFlow],
  );

  if (loading && !dashboard) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl bg-white/70 shadow-lg ring-1 ring-slate-200/70">
            <AppLoader message="Loading dashboard..." minHeightClass="min-h-[28rem]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        {error ? (
          <Card className="border border-rose-200 bg-rose-50 shadow-sm">
            <CardContent className="p-4 text-sm text-rose-800">{error}</CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {primaryKpis.map((item) => (
            <KpiCard key={item.label} {...item} />
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {valueKpis.map((item) => (
            <Card key={item.label} className="border-0 shadow-lg">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950" title={money(item.value)}>
                  {compactMoney(item.value)}
                </p>
                <p className="mt-2 text-xs text-slate-500">{item.helper}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <MiniBarChart title="Procurement Pipeline Graph" items={pipelineGraph} />
          <RingChart title="Attention Distribution Graph" items={attentionGraph} totalLabel="alerts" />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <SectionCard
            title="Work Queues"
            subtitle="Immediate operational backlog that can slow procurement movement."
            actionLabel="Open Indents"
            actionHref="/indents"
          >
            <div className="space-y-5">
              <AttentionRow
                label="Indent items still unassigned"
                value={indentHealth.unassigned_items}
                tone={Number(indentHealth.unassigned_items) > 0 ? "red" : "green"}
                href="/indents"
                helper="Assign procurement officers item-wise so each procurement path can start."
              />
              <AttentionRow
                label="Indent items without estimate"
                value={indentHealth.items_without_estimate}
                tone={Number(indentHealth.items_without_estimate) > 0 ? "amber" : "green"}
                href="/indents"
                helper="Admin can generate indent estimate only after item-wise estimates are filled."
              />
              <AttentionRow
                label="Items requiring administrative approval"
                value={indentHealth.items_requiring_admin_approval}
                tone={Number(indentHealth.items_requiring_admin_approval) > 0 ? "amber" : "green"}
                href="/indents"
                helper="Specific make / brand items needing approval should not be missed."
              />
              <AttentionRow
                label="Cases without procurement officer"
                value={procurementCaseHealth.cases_without_procurement_officer}
                tone={Number(procurementCaseHealth.cases_without_procurement_officer) > 0 ? "red" : "green"}
                href="/procurement-cases"
                helper="These procurement cases have no active case owner."
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Tender & EMD Attention"
            subtitle="Track tender readiness, bidder EMD follow-up, and overdue submission windows."
            actionLabel="Open Tenders"
            actionHref="/tenders"
          >
            <div className="space-y-5">
              <AttentionRow
                label="Tender-mode cases without tender"
                value={procurementCaseHealth.tender_mode_cases_without_tender}
                tone={Number(procurementCaseHealth.tender_mode_cases_without_tender) > 0 ? "red" : "green"}
                href="/procurement-cases"
                helper="Approved tender-route cases should be converted into actual tender records."
              />
              <AttentionRow
                label="Tenders with EMD attention required"
                value={tenderAttention.emd_attention_required}
                tone={Number(tenderAttention.emd_attention_required) > 0 ? "red" : "green"}
                href="/tenders"
                helper="Vendor-side EMD records missing, pending, or still not updated."
              />
              <AttentionRow
                label="EMD pending refunds"
                value={emdHealth.pending_refunds}
                tone={Number(emdHealth.pending_refunds) > 0 ? "amber" : "green"}
                href="/emd"
                helper="Refund approvals or receiving records should be completed promptly."
              />
              <AttentionRow
                label="Overdue bid submission deadlines"
                value={tenderAttention.overdue_submission_deadlines}
                tone={Number(tenderAttention.overdue_submission_deadlines) > 0 ? "red" : "green"}
                href="/tenders"
                helper="Submission deadline has passed but tender is still operationally open."
              />
            </div>
          </SectionCard>

          <SectionCard
            title="PO, PBG & Empanelment Risk"
            subtitle="Financial security and validity items that need close monitoring."
            actionLabel="Open Purchase Orders"
            actionHref="/purchase-orders"
          >
            <div className="space-y-5">
              <AttentionRow
                label="POs without any PBG"
                value={poAndPbgHealth.purchase_orders_without_pbg}
                tone={Number(poAndPbgHealth.purchase_orders_without_pbg) > 0 ? "red" : "green"}
                href="/purchase-orders"
                helper="Released POs should not remain without linked security records."
              />
              <AttentionRow
                label="POs short on required PBG"
                value={poAndPbgHealth.purchase_orders_short_on_pbg}
                tone={Number(poAndPbgHealth.purchase_orders_short_on_pbg) > 0 ? "red" : "green"}
                href="/purchase-orders"
                helper="Total recorded PBG amount is below the required PO security value."
              />
              <AttentionRow
                label="PBG validity expiring in 30 days"
                value={poAndPbgHealth.pbg_validity_expiring_in_30_days}
                tone={Number(poAndPbgHealth.pbg_validity_expiring_in_30_days) > 0 ? "amber" : "green"}
                href="/pbg"
                helper="Renewal, replacement, or claim planning may be needed soon."
              />
              <AttentionRow
                label="Empanelments expiring in 30 days"
                value={empanelmentHealth.expiring_in_30_days}
                tone={Number(empanelmentHealth.expiring_in_30_days) > 0 ? "amber" : "green"}
                href="/empanelments"
                helper="Useful for extension proposals before category coverage lapses."
              />
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <SectionCard title="Procurement Pipeline" subtitle="A single-view flow from inward indent to commercial security follow-up.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <AttentionRow
                label="Received Indents"
                value={overview.indents}
                tone="blue"
                href="/indents"
                helper="Inward letters recorded in PMS"
              />
              <AttentionRow
                label="Working Cases"
                value={overview.procurement_cases}
                tone="blue"
                href="/procurement-cases"
                helper="Indent items grouped into procurement files"
              />
              <AttentionRow
                label="Live Tenders"
                value={overview.tenders}
                tone="blue"
                href="/tenders"
                helper="Portal / tender route records"
              />
              <AttentionRow
                label="Released POs"
                value={overview.purchase_orders}
                tone="blue"
                href="/purchase-orders"
                helper="Commercial award translated into PO"
              />
              <AttentionRow
                label="EMD Records"
                value={overview.emd_entries}
                tone={Number(emdHealth.not_submitted) > 0 ? "amber" : "green"}
                href="/emd"
                helper={`${numberFormat(emdHealth.not_submitted)} not submitted | ${numberFormat(emdHealth.exempted)} exempted`}
              />
              <AttentionRow
                label="PBG Records"
                value={overview.pbg_entries}
                tone={Number(poAndPbgHealth.pbg_release_pending) > 0 ? "amber" : "green"}
                href="/pbg"
                helper={`${numberFormat(poAndPbgHealth.pbg_release_pending)} release follow-ups pending`}
              />
            </div>
          </SectionCard>

          <MiniBarChart
            title="Financial Security Graph"
            items={financialSecurityGraph}
          />
        </div>

        <div className="grid gap-6">
          <SectionCard
            title="Recent Operations"
            subtitle="Latest files entering the procurement workflow."
            actionLabel="Open Indents"
            actionHref="/indents"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <RecentList
                rows={recentActivity.recent_indents}
                emptyMessage="No indent activity yet."
                renderRow={(row) => (
                  <Link key={`indent-${row.id}`} to={`/indents/${row.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">{row.indent_no}</div>
                        <div className="mt-1 text-sm text-slate-500">{row.department_name}</div>
                      </div>
                      <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {label(row.status)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">Received: {formatDate(row.received_date)}</div>
                  </Link>
                )}
              />
              <RecentList
                rows={recentActivity.recent_cases}
                emptyMessage="No procurement cases yet."
                renderRow={(row) => (
                  <Link key={`case-${row.id}`} to={`/procurement-cases/${row.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">{row.case_no}</div>
                        <div className="mt-1 text-sm text-slate-500">{row.title}</div>
                      </div>
                      <span className="shrink-0 whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {label(row.procurement_mode)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">Status: {label(row.status)}</div>
                  </Link>
                )}
              />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
