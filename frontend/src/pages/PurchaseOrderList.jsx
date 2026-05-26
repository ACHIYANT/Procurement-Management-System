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

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });

const label = (value) =>
  String(value || "NA")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

export default function PurchaseOrderList() {
  const navigate = useNavigate();
  const [roles] = useState(() => getCurrentUserRoles());
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [selectedRows, setSelectedRows] = useState(null);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const debouncedSearch = useDebounce(search, 350);

  const fetchPoPage = useCallback(
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
      return procurementRequest(`/purchase-orders?${params.toString()}`);
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
    fetchPage: fetchPoPage,
    deps: [debouncedSearch, sortConfig?.key, sortConfig?.direction],
    pageSize: 100,
    maxBufferRows: 1200,
    trimBatch: 400,
  });

  useEffect(() => {
    if (!error) return undefined;
    const timer = setTimeout(() => {
      setPopup({ open: true, type: "error", message: error.message || "Unable to fetch POs." });
    }, 0);
    return () => clearTimeout(timer);
  }, [error]);

  const columns = [
    { key: "po_no", label: "PO No.", sortable: true },
    { key: "firm.firm_name", label: "Firm" },
    { key: "tender.tender_reference_no", label: "Tender Ref." },
    { key: "po_date", label: "PO Date", sortable: true },
    { key: "po_value", label: "PO Value", format: money, sortable: true },
    { key: "status", label: "Status", format: label, sortable: true },
    { key: "inspection_status", label: "Inspection", format: label, sortable: true },
    { key: "delivery_status", label: "Delivery", format: label, sortable: true },
  ];

  const requestUpdateApproval = async (id, row) => {
    try {
      const result = await requestSavedRecordChange({
        moduleKey: "purchaseOrders",
        entityType: "purchase_order",
        entityId: id,
        title: `Purchase order change request - ${row?.po_no || id}`,
        oldPayload: row || null,
      });
      if (result) {
        setPopup({ open: true, type: "success", message: "PO update approval request sent." });
      }
    } catch (approvalError) {
      setPopup({ open: true, type: "error", message: approvalError.message || "Unable to request approval." });
    }
  };

  return (
    <>
      <ListPage
        title="Purchase Orders"
        subtitle="Open a PO to view or add PBG records. New POs should be created from the related tender detail page."
        columns={columns}
        data={rows}
        loading={loading}
        onAdd={() => navigate("/tenders")}
        addLabel="Open Tenders"
        onUpdate={(id) => navigate(`/purchase-orders/${id}`)}
        onSearch={setSearch}
        searchValue={search}
        selectedRows={selectedRows}
        setSelectedRows={setSelectedRows}
        showUpdate
        showRequestUpdateApproval
        onRequestUpdateApproval={requestUpdateApproval}
        showAdd={canAccessFeature(roles, "purchaseOrders", "create")}
        updateTooltip="Select one PO to open details."
        searchPlaceholder="Search PO, firm, tender..."
        table={
          <ListTable
            columns={columns}
            data={rows}
            idCol="id"
            selectedRows={selectedRows}
            onRowSelect={(id) => setSelectedRows((current) => (current === id ? null : id))}
            onRowClick={(id) => navigate(`/purchase-orders/${id}`)}
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
