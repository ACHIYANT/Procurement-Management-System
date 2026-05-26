import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import PopupMessage from "@/components/PopupMessage";
import { requestSavedRecordChange } from "@/lib/approval-request-helper";
import { procurementRequest } from "@/lib/procurement-api";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import useDebounce from "@/hooks/useDebounce";

const statusChipMap = {
  active: { color: "green" },
  extended: { color: "blue" },
  released: { color: "cyan" },
  expired: { color: "yellow" },
  forfeited: { color: "red" },
};

const releaseChipMap = {
  held: { color: "gray" },
  pending: { color: "yellow" },
  released: { color: "green" },
  forfeited: { color: "red" },
};

const formatLabel = (value) =>
  String(value || "NA")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const money = (value) => {
  const amount = Number(value || 0);
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
};

export default function PbgList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [selectedRows, setSelectedRows] = useState(null);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const debouncedSearch = useDebounce(search, 350);

  const fetchPbgPage = useCallback(
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

      return procurementRequest(`/pbg?${params.toString()}`);
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
    fetchPage: fetchPbgPage,
    deps: [debouncedSearch, sortConfig?.key, sortConfig?.direction],
    pageSize: 100,
    maxBufferRows: 1200,
    trimBatch: 400,
  });

  useEffect(() => {
    if (!error) return undefined;

    const timer = setTimeout(() => {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to load PBG records.",
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [error]);

  const columns = [
    { key: "id", label: "ID", sortable: true },
    { key: "firm.firm_name", label: "Firm" },
    { key: "purchase_order.po_no", label: "PO No." },
    { key: "purchase_order.po_date", label: "PO Date" },
    { key: "purchase_order.po_value", label: "PO Value", format: money },
    { key: "pbg_amount", label: "PBG Amount", format: money, sortable: true },
    {
      key: "status",
      label: "PBG Status",
      chipMap: statusChipMap,
      format: formatLabel,
      sortable: true,
    },
    { key: "bank_guarantee_no", label: "BG No.", sortable: true },
    { key: "issuing_bank_name", label: "Bank", sortable: true },
    { key: "valid_upto", label: "Valid Upto", sortable: true },
    { key: "claim_period_upto", label: "Claim Upto", sortable: true, sortKey: "claim_period_upto" },
    {
      key: "refund_status",
      label: "Release",
      chipMap: releaseChipMap,
      format: formatLabel,
      sortable: true,
    },
  ];

  const requestUpdateApproval = async (id, row) => {
    try {
      const result = await requestSavedRecordChange({
        moduleKey: "pbg",
        entityType: "pbg_entry",
        entityId: id,
        title: `PBG change request - ${row?.bank_guarantee_no || row?.purchase_order?.po_no || id}`,
        oldPayload: row || null,
      });
      if (result) {
        setPopup({ open: true, type: "success", message: "PBG update approval request sent." });
      }
    } catch (approvalError) {
      setPopup({ open: true, type: "error", message: approvalError.message || "Unable to request approval." });
    }
  };

  return (
    <>
      <ListPage
        title="PBG Management"
        subtitle="PO-wise performance bank guarantee validity, claim period, release, and receiving details. Open a PO to add a new PBG."
        columns={columns}
        data={rows}
        loading={loading}
        onAdd={() => navigate("/purchase-orders")}
        addLabel="Open POs"
        onUpdate={(id) => navigate(`/pbg/${id}/edit`)}
        onSearch={setSearch}
        searchValue={search}
        selectedRows={selectedRows}
        setSelectedRows={setSelectedRows}
        searchPlaceholder="Search firm, PO, BG no., bank..."
        idCol="id"
        showUpdate
        showRequestUpdateApproval
        onRequestUpdateApproval={requestUpdateApproval}
        updateTooltip="Select one PBG record to update validity/release details."
        showFilter={false}
        table={
          <ListTable
            columns={columns}
            data={rows}
            idCol="id"
            selectedRows={selectedRows}
            onRowSelect={(id) => setSelectedRows((current) => (current === id ? null : id))}
            onRowClick={(id) => navigate(`/pbg/${id}/edit`)}
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
