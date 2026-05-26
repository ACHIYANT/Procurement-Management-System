import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import PopupMessage from "@/components/PopupMessage";
import { requestSavedRecordChange } from "@/lib/approval-request-helper";
import { procurementRequest } from "@/lib/procurement-api";
import { canAccessFeature, getCurrentUserRoles } from "@/lib/roles";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import useDebounce from "@/hooks/useDebounce";

const formatLabel = (value) =>
  String(value || "NA")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });

const tenderDisplayReference = (_, row) => {
  if (row.portal_type === "gem") return row.portal_bid_no || "GeM Bid pending";
  if (row.portal_type === "nic") return row.tender_reference_no || "Tender Reference No. pending";
  if (row.portal_type === "gem_nic_split") {
    return `GeM: ${row.portal_bid_no || "pending"} | Tender Ref: ${row.tender_reference_no || "pending"}`;
  }
  return formatLabel(row.portal_type);
};

const formatAllocation = (_, row) => {
  const quantity = Number(row?.allocation_quantity || 0);

  if (quantity > 0) return `Qty ${quantity}`;
  return "NA";
};

const chipClassMap = {
  gray: "bg-slate-200 text-slate-800 ring-1 ring-slate-300",
  green: "bg-emerald-200 text-emerald-950 ring-1 ring-emerald-300",
  red: "bg-rose-200 text-rose-950 ring-1 ring-rose-300",
};

const summaryChip = (label, color) => (
  <span
    className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
      chipClassMap[color] || chipClassMap.gray
    }`}
  >
    {label || "NA"}
  </span>
);

function LegendItem({ color = "gray", label }) {
  const colorMap = {
    green: "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]",
    red: "bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.18)]",
    gray: "bg-slate-400 shadow-[0_0_0_4px_rgba(148,163,184,0.18)]",
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`h-3.5 w-3.5 rounded-full ${colorMap[color] || colorMap.gray}`} />
      <span className="text-xs font-medium text-slate-700">{label}</span>
    </div>
  );
}

const getTenderRowClassName = (row) => {
  const hasNoLinkedWork =
    (Number(row?.emd_summary?.total_vendors || 0) === 0) &&
    (Number(row?.pbg_summary?.purchase_orders || 0) === 0);

  const hasIssue =
    Number(row?.emd_summary?.short_amount || 0) > 0 ||
    Number(row?.pbg_summary?.short_amount || 0) > 0 ||
    (Number(row?.emd_summary?.total_vendors || 0) > 0 &&
      (Number(row?.emd_summary?.pending_count || 0) > 0 ||
        Number(row?.emd_summary?.emd_records || 0) < Number(row?.emd_summary?.total_vendors || 0))) ||
    (Number(row?.pbg_summary?.purchase_orders || 0) > 0 &&
      (Number(row?.pbg_summary?.total_entries || 0) === 0 ||
        Number(row?.pbg_summary?.short_po_count || 0) > 0));

  if (hasNoLinkedWork) {
    return "bg-slate-100/85 border-l-[6px] border-slate-400";
  }

  if (hasIssue) {
    return "bg-rose-100/90 border-l-[6px] border-rose-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]";
  }

  return "bg-emerald-100/85 border-l-[6px] border-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]";
};

export default function TenderList() {
  const navigate = useNavigate();
  const [roles] = useState(() => getCurrentUserRoles());
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [selectedRows, setSelectedRows] = useState(null);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const debouncedSearch = useDebounce(search, 350);

  const fetchTenderPage = useCallback(
    async ({ cursor, limit }) => {
      const params = new URLSearchParams({
        cursorMode: "true",
        limit: String(limit),
      });

      if (cursor) params.set("cursor", cursor);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (sortConfig?.key) {
        params.set("sortBy", sortConfig.key);
        params.set("sortDir", sortConfig.direction);
      }

      return procurementRequest(`/tenders?${params.toString()}`);
    },
    [debouncedSearch, sortConfig],
  );

  const {
    rows,
    loading,
    isFetchingMore,
    hasMore,
    loadMore,
    virtualStartIndex,
    error,
  } = useCursorWindowedList({
    fetchPage: fetchTenderPage,
    deps: [debouncedSearch, sortConfig?.key, sortConfig?.direction],
    pageSize: 100,
    maxBufferRows: 1200,
    trimBatch: 400,
  });

  useEffect(() => {
    if (!error) return undefined;

    const timer = setTimeout(() => {
      setPopup({ open: true, type: "error", message: error.message || "Unable to fetch tenders." });
    }, 0);

    return () => clearTimeout(timer);
  }, [error]);

  const columns = [
    { key: "display_reference", label: "Reference", render: tenderDisplayReference },
    { key: "tender_title", label: "Title", sortable: true },
    { key: "portal_type", label: "Mode", format: formatLabel, sortable: true },
    { key: "leg_label", label: "Leg" },
    { key: "allocation_display", label: "Split Qty", render: formatAllocation },
    { key: "portal_bid_no", label: "GeM Bid ID" },
    { key: "portal_ra_no", label: "GeM RA No." },
    { key: "tender_reference_no", label: "Tender Reference No." },
    { key: "portal_tender_id", label: "Tender ID" },
    {
      key: "emd_list_chip_label",
      label: "EMD",
      render: (_, row) => summaryChip(row.emd_list_chip_label, row.emd_list_chip_color),
    },
    {
      key: "pbg_list_chip_label",
      label: "PBG",
      render: (_, row) => summaryChip(row.pbg_list_chip_label, row.pbg_list_chip_color),
    },
    { key: "tender_value", label: "Value", format: money, sortable: true },
    { key: "emd_amount", label: "EMD", format: money, sortable: true },
    { key: "location_scope", label: "Location", sortable: true },
  ];

  const requestUpdateApproval = async (id, row) => {
    try {
      const result = await requestSavedRecordChange({
        moduleKey: "tenders",
        entityType: "tender",
        entityId: id,
        title: `Tender change request - ${row?.tender_title || id}`,
        oldPayload: row || null,
      });
      if (result) {
        setPopup({ open: true, type: "success", message: "Tender update approval request sent." });
      }
    } catch (approvalError) {
      setPopup({ open: true, type: "error", message: approvalError.message || "Unable to request approval." });
    }
  };

  return (
    <>
      <ListPage
        title="Tender Management"
        subtitle="Open a tender to add firms from master, generate EMD records, and create linked purchase orders."
        columns={columns}
        data={rows}
        loading={loading}
        onAdd={() => navigate("/tenders/new")}
        onUpdate={(id) => navigate(`/tenders/${id}`)}
        onSearch={setSearch}
        searchValue={search}
        selectedRows={selectedRows}
        setSelectedRows={setSelectedRows}
        showUpdate
        showRequestUpdateApproval
        onRequestUpdateApproval={requestUpdateApproval}
        showAdd={canAccessFeature(roles, "tenders", "create")}
        updateTooltip="Select one tender to open details."
        searchPlaceholder="Search tender no., title, bid no..."
        aboveContent={
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-blue-50/70 px-4 py-3 shadow-sm">
            <div className="mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Tender Status Legend
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <LegendItem color="gray" label="No vendor or PO linked yet" />
              <LegendItem color="red" label="There is an issue to resolve" />
              <LegendItem color="green" label="No issue in EMD/PBG tracking" />
            </div>
          </div>
        }
        table={
          <ListTable
            columns={columns}
            data={rows}
            idCol="id"
            getRowClassName={getTenderRowClassName}
            selectedRows={selectedRows}
            onRowSelect={(id) => setSelectedRows((current) => (current === id ? null : id))}
            onRowClick={(id) => navigate(`/tenders/${id}`)}
            sortConfig={sortConfig}
            onSortChange={setSortConfig}
            onLoadMore={loadMore}
            hasMore={hasMore}
            loading={isFetchingMore}
            virtualStartIndex={virtualStartIndex}
          />
        }
      />
      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={() => setPopup({ open: false, type: "info", message: "" })}
      />
    </>
  );
}
