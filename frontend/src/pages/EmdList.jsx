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
  submitted: { color: "green" },
  not_submitted: { color: "yellow" },
  exempted: { color: "blue" },
  transferred_to_hartron: { color: "cyan" },
};

const refundChipMap = {
  not_due: { color: "gray" },
  pending: { color: "yellow" },
  refunded: { color: "green" },
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

export default function EmdList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [selectedRows, setSelectedRows] = useState(null);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const debouncedSearch = useDebounce(search, 350);

  const fetchEmdPage = useCallback(
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

      return procurementRequest(`/emd?${params.toString()}`);
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
    fetchPage: fetchEmdPage,
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
        message: error.message || "Unable to load EMD records.",
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [error]);

  const columns = [
    { key: "id", label: "ID", sortable: true },
    { key: "tender_vendor.firm.firm_name", label: "Firm" },
    { key: "tender.tender_reference_no", label: "Tender Ref." },
    { key: "tender.tender_title", label: "Tender Title" },
    {
      key: "emd_submission_status",
      label: "EMD Status",
      chipMap: statusChipMap,
      format: formatLabel,
      sortable: true,
    },
    {
      key: "emd_exemption_status",
      label: "Exemption",
      format: formatLabel,
      sortable: true,
      sortKey: "emd_exemption_status",
    },
    {
      key: "submission_mode",
      label: "Mode",
      format: formatLabel,
      sortable: true,
      sortKey: "submission_mode",
    },
    {
      key: "deposit_date",
      label: "Submission Date",
      sortable: true,
      sortKey: "deposit_date",
    },
    { key: "emd_amount", label: "EMD Amount", format: money, sortable: true },
    { key: "tender_fee_amount", label: "Tender Fee", format: money, sortable: true },
    { key: "finance_reference_no", label: "Finance Ref.", sortable: true },
    {
      key: "refund_status",
      label: "Refund",
      chipMap: refundChipMap,
      format: formatLabel,
      sortable: true,
    },
  ];

  const requestUpdateApproval = async (id, row) => {
    try {
      const result = await requestSavedRecordChange({
        moduleKey: "emd",
        entityType: "emd_entry",
        entityId: id,
        title: `EMD change request - ${row?.tender_vendor?.firm?.firm_name || id}`,
        oldPayload: row || null,
      });
      if (result) {
        setPopup({ open: true, type: "success", message: "EMD update approval request sent." });
      }
    } catch (approvalError) {
      setPopup({ open: true, type: "error", message: approvalError.message || "Unable to request approval." });
    }
  };

  return (
    <>
      <ListPage
        title="EMD Management"
        subtitle="Tender-wise bidder EMD, exemption, instrument, finance reference, and refund records."
        columns={columns}
        data={rows}
        loading={loading}
        onAdd={() => navigate("/emd/new")}
        onUpdate={(id) => navigate(`/emd/${id}/edit`)}
        onSearch={setSearch}
        searchValue={search}
        selectedRows={selectedRows}
        setSelectedRows={setSelectedRows}
        searchPlaceholder="Search firm, tender, finance ref..."
        idCol="id"
        showUpdate
        showRequestUpdateApproval
        onRequestUpdateApproval={requestUpdateApproval}
        updateTooltip="Select one EMD record to update refund/status details."
        showFilter={false}
        table={
          <ListTable
            columns={columns}
            data={rows}
            idCol="id"
            selectedRows={selectedRows}
            onRowSelect={(id) => setSelectedRows((current) => (current === id ? null : id))}
            onRowClick={(id) => navigate(`/emd/${id}/edit`)}
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
