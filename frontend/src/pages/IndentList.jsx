import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { procurementRequest } from "@/lib/procurement-api";
import { requestSavedRecordChange } from "@/lib/approval-request-helper";
import { canAccessFeature, getCurrentUserProfile, getCurrentUserRoles, PMS_ROLES } from "@/lib/roles";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import useDebounce from "@/hooks/useDebounce";

const label = (value) =>
  String(value || "NA")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });

const formatQuantity = (value) => {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) return value || "0";
  return Number.isInteger(numeric) ? String(numeric) : String(numeric);
};

export default function IndentList() {
  const navigate = useNavigate();
  const [roles] = useState(() => getCurrentUserRoles());
  const [currentUser] = useState(() => getCurrentUserProfile());
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [selectedRows, setSelectedRows] = useState(null);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const [workQueue, setWorkQueue] = useState(null);
  const debouncedSearch = useDebounce(search, 350);
  const isProcurementOfficer = roles.includes(PMS_ROLES.PROCUREMENT_OFFICER);
  const isIndentInitiator = roles.includes(PMS_ROLES.INDENT_INITIATOR);
  const isAdminSide = roles.includes(PMS_ROLES.ADMIN) || roles.includes(PMS_ROLES.SUPER_ADMIN);
  const showQueueOnly = isProcurementOfficer && !isAdminSide;

  const groupedWorkQueue = useMemo(() => {
    const rows = Array.isArray(workQueue?.rows) ? workQueue.rows : [];
    const grouped = new Map();

    rows.forEach((item) => {
      const indentId = item?.indent_id;
      if (!grouped.has(indentId)) {
        grouped.set(indentId, {
          indentId,
          indent: item?.indent || {},
          items: [],
          totalItems: 0,
          pendingEstimateItems: 0,
          estimatedItems: 0,
          returnedItems: 0,
          totalEstimatedAmount: 0,
        });
      }

      const bucket = grouped.get(indentId);
      bucket.items.push(item);
      bucket.totalItems += 1;
      bucket.totalEstimatedAmount += Number(item?.estimated_amount || 0);

      const assignmentStatus = String(item?.assignment_status || "").toLowerCase();
      const hasEstimate = Number(item?.estimated_amount || 0) > 0 || Number(item?.estimated_rate || 0) > 0;
      if (assignmentStatus === "returned") bucket.returnedItems += 1;
      if (hasEstimate) bucket.estimatedItems += 1;
      else bucket.pendingEstimateItems += 1;
    });

    return Array.from(grouped.values()).sort((left, right) => {
      const rightTime = new Date(right?.indent?.createdAt || right?.indent?.updatedAt || 0).getTime();
      const leftTime = new Date(left?.indent?.createdAt || left?.indent?.updatedAt || 0).getTime();
      return rightTime - leftTime;
    });
  }, [workQueue]);

  const fetchIndentPage = useCallback(
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
      return procurementRequest(`/indents?${params.toString()}`);
    },
    [debouncedSearch, sortConfig],
  );

  const { rows, loading, isFetchingMore, hasMore, loadMore, virtualStartIndex, error } =
    useCursorWindowedList({
      fetchPage: fetchIndentPage,
      deps: [debouncedSearch, sortConfig?.key, sortConfig?.direction],
      pageSize: 100,
      maxBufferRows: 1200,
      trimBatch: 400,
    });

  useEffect(() => {
    if (!error) return undefined;
    const timer = setTimeout(() => {
      setPopup({ open: true, type: "error", message: error.message || "Unable to fetch indents." });
    }, 0);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!showQueueOnly || !currentUser?.empcode) {
      setWorkQueue(null);
      return undefined;
    }

    let ignore = false;
    const timer = setTimeout(async () => {
      try {
        const data = await procurementRequest(`/indents/work-queue?empcode=${encodeURIComponent(currentUser.empcode)}`);
        if (!ignore) setWorkQueue(data);
      } catch (queueError) {
        const isMissingEmployee = Number(queueError?.statusCode || queueError?.status || 0) === 404
          || /procurement employee not found/i.test(String(queueError?.message || ""));
        if (!ignore) {
          setWorkQueue(null);
          if (!isMissingEmployee) {
            setPopup({
              open: true,
              type: "error",
              message: queueError.message || "Unable to load your indent work queue.",
            });
          }
        }
      }
    }, 0);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [currentUser?.empcode, showQueueOnly]);

  const columns = [
    { key: "system_indent_no", label: "PMS Indent No.", sortable: true },
    { key: "indent_no", label: "Letter Ref.", sortable: true },
    { key: "indent_date", label: "Indent Date", sortable: true },
    { key: "cfms_no", label: "CFMS No.", sortable: true },
    { key: "received_date", label: "Received Date", sortable: true },
    { key: "department_name", label: "Department", sortable: true },
    { key: "status", label: "Status", format: label, sortable: true },
    { key: "item_count", label: "Items" },
    { key: "assigned_item_count", label: "Assigned" },
    { key: "returned_item_count", label: "Returned" },
    { key: "estimated_item_count", label: "Estimated" },
    { key: "procurement_case_count", label: "Cases" },
    { key: "total_estimated_amount", label: "Est. Amount", format: money },
    { key: "location_scope", label: "Location", sortable: true },
  ];

  const requestUpdateApproval = async (id, row) => {
    try {
      const result = await requestSavedRecordChange({
        moduleKey: "indents",
        entityType: "indent",
        entityId: id,
        title: `Indent update request - ${row?.system_indent_no || row?.indent_no || id}`,
        oldPayload: row || null,
      });
      if (result) {
        setPopup({ open: true, type: "success", message: "Indent update approval request sent." });
      }
    } catch (approvalError) {
      setPopup({ open: true, type: "error", message: approvalError.message || "Unable to request approval." });
    }
  };

  const queueOnlyContent = isProcurementOfficer && workQueue ? (
    <div className="min-h-full bg-[#f5f5f7] px-4 py-7 text-[#1d1d1f]">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="overflow-hidden rounded-[32px] bg-black px-6 py-6 text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)] md:px-8 md:py-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">
            Procurement Management System
          </p>
          <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">Indent Item Queue</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-white/70 md:text-[15px]">
            Only your assigned indent items are shown here. Add-indent and master indent listing remain under admin control.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Assigned</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{workQueue?.summary?.total_items || 0}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/85 p-4 shadow-sm">
            <p className="text-sm text-amber-700">Pending Estimate</p>
            <p className="mt-2 text-2xl font-semibold text-amber-950">{workQueue?.summary?.pending_estimate_items || 0}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/85 p-4 shadow-sm">
            <p className="text-sm text-emerald-700">Estimated</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-950">{workQueue?.summary?.estimated_items || 0}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/85 p-4 shadow-sm">
            <p className="text-sm text-rose-700">Returned</p>
            <p className="mt-2 text-2xl font-semibold text-rose-950">{workQueue?.summary?.returned_items || 0}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[1.1fr_1.7fr_0.7fr_0.7fr_0.7fr_0.9fr_0.9fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 lg:grid">
            <span>Indent</span>
            <span>Department / Items</span>
            <span>Assigned</span>
            <span>Pending</span>
            <span>Estimated</span>
            <span>Est. Amount</span>
            <span>Action</span>
          </div>

          {groupedWorkQueue.map((group) => (
            <button
              key={group.indentId}
              type="button"
              onClick={() => navigate(`/indents/${group.indentId}`)}
              className="block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-blue-50 last:border-b-0"
            >
              <div className="space-y-2 lg:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950">{group.indent?.indent_no || "NA"}</p>
                    <p className="truncate text-sm text-slate-600">{group.indent?.department_name || "NA"}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                    {group.totalItems} items
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Pending {group.pendingEstimateItems} | Estimated {group.estimatedItems} | Returned {group.returnedItems}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {group.items.map((item) => `${item.item_name} (${formatQuantity(item.quantity)} ${item.unit})`).join(", ")}
                </p>
              </div>

              <div className="hidden grid-cols-[1.1fr_1.7fr_0.7fr_0.7fr_0.7fr_0.9fr_0.9fr] items-center gap-3 lg:grid">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{group.indent?.indent_no || "NA"}</p>
                  <p className="truncate text-xs text-slate-500">CFMS {group.indent?.cfms_no || "NA"}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-700">{group.indent?.department_name || "NA"}</p>
                  <p className="truncate text-xs text-slate-500">
                    {group.items.map((item) => `${item.item_name} (${formatQuantity(item.quantity)} ${item.unit})`).join(", ")}
                  </p>
                </div>
                <p className="text-sm font-medium text-slate-800">{group.totalItems}</p>
                <p className="text-sm font-medium text-amber-700">{group.pendingEstimateItems}</p>
                <p className="text-sm font-medium text-emerald-700">{group.estimatedItems}</p>
                <p className="text-sm font-medium text-slate-800">{money(group.totalEstimatedAmount)}</p>
                <div>
                  <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    Open
                  </span>
                </div>
              </div>
            </button>
          ))}

          {!groupedWorkQueue.length ? (
            <div className="px-4 py-6 text-sm text-slate-500">
              No indent item is currently assigned to you.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  if (showQueueOnly) {
    return (
      <>
        {queueOnlyContent}
        <PopupMessage
          open={popup.open}
          type={popup.type}
          message={popup.message}
          onClose={() => setPopup({ open: false, type: "info", message: "" })}
        />
      </>
    );
  }

  return (
    <>
      <ListPage
        title="Indent Management"
        subtitle="Capture indent headers, multiple items, and item-wise officer assignment before procurement cases are opened."
        columns={columns}
        data={rows}
        loading={loading}
        onAdd={() => navigate("/indents/new")}
        addLabel="Add Indent"
        onUpdate={(id) => navigate(`/indents/${id}`)}
        onSearch={setSearch}
        searchValue={search}
        selectedRows={selectedRows}
        setSelectedRows={setSelectedRows}
        showUpdate
        showRequestUpdateApproval
        onRequestUpdateApproval={requestUpdateApproval}
        showAdd={canAccessFeature(roles, "indents", "create") || isIndentInitiator}
        updateTooltip="Select one indent to open details."
        searchPlaceholder="Search indent no., CFMS no., department..."
        aboveContent={
          isProcurementOfficer && workQueue ? (
            <div className="rounded-3xl bg-white/85 p-5 shadow-xl ring-1 ring-slate-200/80">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                    My Item Queue
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    Assigned indent items for {workQueue?.employee?.employee_name || "current officer"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Use the indent detail page to enter estimates or return items back to admin with a reason.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-sm text-slate-500">Total Assigned</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{workQueue?.summary?.total_items || 0}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                  <p className="text-sm text-amber-700">Pending Estimate</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-950">{workQueue?.summary?.pending_estimate_items || 0}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                  <p className="text-sm text-emerald-700">Estimated</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-950">{workQueue?.summary?.estimated_items || 0}</p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
                  <p className="text-sm text-rose-700">Returned To Admin</p>
                  <p className="mt-2 text-2xl font-semibold text-rose-950">{workQueue?.summary?.returned_items || 0}</p>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {groupedWorkQueue.slice(0, 6).map((group) => (
                  <button
                    key={group.indentId}
                    type="button"
                    onClick={() => navigate(`/indents/${group.indentId}`)}
                    className="block w-full border-b border-slate-100 bg-slate-50/70 p-3 text-left transition hover:bg-blue-50 last:border-b-0"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          {group.indent?.indent_no || "NA"}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {group.indent?.department_name || "NA"}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                          {group.totalItems} items | {group.pendingEstimateItems} pending | {group.estimatedItems} estimated
                        </p>
                      </div>
                      <div className="text-sm text-slate-600 md:text-right">
                        <p className="font-medium text-slate-800">{money(group.totalEstimatedAmount)}</p>
                        <p>Open indent workflow</p>
                      </div>
                    </div>
                  </button>
                ))}
                {!groupedWorkQueue.length ? (
                  <div className="px-4 py-5 text-sm text-slate-500">
                    No indent item is currently assigned to you.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null
        }
        table={
          <ListTable
            columns={columns}
            data={rows}
            idCol="id"
            selectedRows={selectedRows}
            onRowSelect={(id) => setSelectedRows((current) => (current === id ? null : id))}
            onRowClick={(id) => navigate(`/indents/${id}`)}
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
