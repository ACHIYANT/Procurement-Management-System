import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import PopupMessage from "@/components/PopupMessage";
import { requestSavedRecordChange } from "@/lib/approval-request-helper";
import { procurementRequest } from "@/lib/procurement-api";
import { canAccessFeature, getCurrentUserRoles } from "@/lib/roles";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import useDebounce from "@/hooks/useDebounce";

const label = (value) =>
  String(value || "NA")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

export default function CommitteeList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [roles] = useState(() => getCurrentUserRoles());
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [selectedRows, setSelectedRows] = useState(null);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const debouncedSearch = useDebounce(search, 350);

  const procurementCaseId = searchParams.get("procurementCaseId") || "";
  const tenderId = searchParams.get("tenderId") || "";

  const fetchCommitteePage = useCallback(
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
      if (procurementCaseId) params.set("procurement_case_id", procurementCaseId);
      if (tenderId) params.set("tender_id", tenderId);
      return procurementRequest(`/committees?${params.toString()}`);
    },
    [debouncedSearch, procurementCaseId, tenderId, sortConfig],
  );

  const { rows, loading, isFetchingMore, hasMore, loadMore, virtualStartIndex, error } =
    useCursorWindowedList({
      fetchPage: fetchCommitteePage,
      deps: [debouncedSearch, procurementCaseId, tenderId, sortConfig?.key, sortConfig?.direction],
      pageSize: 100,
      maxBufferRows: 1200,
      trimBatch: 400,
    });

  useEffect(() => {
    if (!error) return undefined;
    const timer = setTimeout(() => {
      setPopup({ open: true, type: "error", message: error.message || "Unable to fetch committee meetings." });
    }, 0);
    return () => clearTimeout(timer);
  }, [error]);

  const summary = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.total += 1;
          if (row.meeting_type === "technical_committee") acc.technical += 1;
          if (["purchase_committee", "purchase_committee_lower", "purchase_committee_upper"].includes(row.meeting_type)) acc.purchase += 1;
          if (["dhppc", "hppc"].includes(row.meeting_type)) acc.highPower += 1;
          acc.members += Number(row.member_count || 0);
          return acc;
        },
        { total: 0, technical: 0, purchase: 0, highPower: 0, members: 0 },
      ),
    [rows],
  );

  const columns = [
    { key: "meeting_no", label: "Meeting No.", sortable: true },
    { key: "meeting_type", label: "Type", format: label, sortable: true },
    { key: "purpose", label: "Purpose", format: label, sortable: true },
    { key: "meeting_date", label: "Meeting Date", sortable: true },
    { key: "approval_forum", label: "Forum", format: label, sortable: true },
    { key: "member_count", label: "Members" },
    {
      key: "indent_no",
      label: "Indent No.",
      render: (_, row) => row.procurement_case?.indent?.indent_no || "NA",
    },
    {
      key: "procurement_case_no",
      label: "Procurement Case",
      render: (_, row) => row.procurement_case?.case_no || "NA",
    },
    {
      key: "tender_id",
      label: "Tender ID",
      render: (_, row) =>
        row.tender?.portal_bid_no ||
        row.tender?.tender_reference_no ||
        row.tender?.portal_tender_id ||
        (row.tender?.id ? `Tender #${row.tender.id}` : "NA"),
    },
    {
      key: "tender_title",
      label: "Tender",
      render: (_, row) => row.tender?.tender_title || "NA",
    },
  ];

  const requestUpdateApproval = async (id, row) => {
    try {
      const result = await requestSavedRecordChange({
        moduleKey: "committees",
        entityType: "committee_meeting",
        entityId: id,
        title: `Committee meeting change request - ${row?.meeting_no || id}`,
        oldPayload: row || null,
      });
      if (result) {
        setPopup({ open: true, type: "success", message: "Committee update approval request sent." });
      }
    } catch (approvalError) {
      setPopup({ open: true, type: "error", message: approvalError.message || "Unable to request approval." });
    }
  };

  return (
    <>
      <ListPage
        title="Committee Meetings"
        subtitle="Record specification, technical, purchase, DHPPC, HPPC, and other committee rounds with linked indent, procurement case, and tender context."
        columns={columns}
        data={rows}
        loading={loading}
        onAdd={() => {
          const params = new URLSearchParams();
          if (procurementCaseId) params.set("procurementCaseId", procurementCaseId);
          if (tenderId) params.set("tenderId", tenderId);
          navigate(`/committees/new${params.toString() ? `?${params.toString()}` : ""}`);
        }}
        addLabel="Add Committee Meeting"
        onUpdate={(id) => navigate(`/committees/${id}`)}
        onSearch={setSearch}
        searchValue={search}
        selectedRows={selectedRows}
        setSelectedRows={setSelectedRows}
        showUpdate
        showRequestUpdateApproval
        onRequestUpdateApproval={requestUpdateApproval}
        showAdd={canAccessFeature(roles, "committees", "create")}
        updateTooltip="Select one meeting to open details."
        searchPlaceholder="Search meeting no., type, case..."
        actions={[
          {
            label: "Member Attendance Report",
            onClick: () => navigate("/committees/reports/member-attendance"),
          },
        ]}
        aboveContent={
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <p className="text-sm text-slate-500">Meetings</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{summary.total}</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-4 shadow-sm">
              <p className="text-sm text-blue-700">Technical</p>
              <p className="mt-2 text-2xl font-semibold text-blue-950">{summary.technical}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4 shadow-sm">
              <p className="text-sm text-amber-700">Purchase</p>
              <p className="mt-2 text-2xl font-semibold text-amber-950">{summary.purchase}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-4 shadow-sm">
              <p className="text-sm text-emerald-700">DHPPC / HPPC</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-950">{summary.highPower}</p>
            </div>
          </div>
        }
        table={
          <ListTable
            columns={columns}
            data={rows}
            idCol="id"
            selectedRows={selectedRows}
            onRowSelect={(id) => setSelectedRows((current) => (current === id ? null : id))}
            onRowClick={(id) => navigate(`/committees/${id}`)}
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
