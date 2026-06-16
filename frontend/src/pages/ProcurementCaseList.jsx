import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import PopupMessage from "@/components/PopupMessage";
import {
  findApprovedSavedRecordChange,
  getSavedRecordUpdatePath,
  requestSavedRecordChange,
} from "@/lib/approval-request-helper";
import { procurementRequest } from "@/lib/procurement-api";
import { canAccessFeature, getCurrentUserRoles } from "@/lib/roles";
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

export default function ProcurementCaseList() {
  const navigate = useNavigate();
  const [roles] = useState(() => getCurrentUserRoles());
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [selectedRows, setSelectedRows] = useState(null);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const debouncedSearch = useDebounce(search, 350);

  const fetchCasePage = useCallback(
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
      return procurementRequest(`/procurement-cases?${params.toString()}`);
    },
    [debouncedSearch, sortConfig],
  );

  const { rows, loading, isFetchingMore, hasMore, loadMore, virtualStartIndex, error } =
    useCursorWindowedList({
      fetchPage: fetchCasePage,
      deps: [debouncedSearch, sortConfig?.key, sortConfig?.direction],
      pageSize: 100,
      maxBufferRows: 1200,
      trimBatch: 400,
    });

  useEffect(() => {
    if (!error) return undefined;
    const timer = setTimeout(() => {
      setPopup({ open: true, type: "error", message: error.message || "Unable to fetch procurement cases." });
    }, 0);
    return () => clearTimeout(timer);
  }, [error]);

  const columns = [
    { key: "case_no", label: "Case No.", sortable: true },
    { key: "title", label: "Title", sortable: true },
    {
      key: "indent.system_indent_no",
      label: "PMS Indent",
      render: (_, row) => row.indent?.system_indent_no || row.indent?.indent_no || "NA",
    },
    { key: "procurement_mode", label: "Mode", format: label, sortable: true },
    { key: "procurement_officer.employee_name", label: "Procurement Officer" },
    { key: "status", label: "Status", format: label, sortable: true },
    { key: "item_count", label: "Items" },
    { key: "tender_count", label: "Tenders" },
    { key: "estimated_value", label: "Case Value", format: money, sortable: true },
    { key: "location_scope", label: "Location", sortable: true },
  ];

  const requestUpdateApproval = async (id, row) => {
    try {
      const result = await requestSavedRecordChange({
        moduleKey: "procurementCases",
        entityType: "procurement_case",
        entityId: id,
        title: `Procurement case change request - ${row?.case_no || id}`,
        oldPayload: row || null,
      });
      if (result) {
        setPopup({ open: true, type: "success", message: "Procurement case update approval request sent." });
      }
    } catch (approvalError) {
      setPopup({ open: true, type: "error", message: approvalError.message || "Unable to request approval." });
    }
  };

  const openProcurementCaseForUpdate = async (id) => {
    try {
      const approvedRequest = await findApprovedSavedRecordChange({
        moduleKey: "procurementCases",
        entityType: "procurement_case",
        entityId: id,
      });
      if (approvedRequest?.id) {
        navigate(
          getSavedRecordUpdatePath({
            moduleKey: "procurementCases",
            entityType: "procurement_case",
            entityId: id,
            approvalRequestId: approvedRequest.id,
          }),
        );
        return;
      }
      navigate(`/procurement-cases/${id}`);
    } catch (approvalError) {
      setPopup({
        open: true,
        type: "error",
        message: approvalError.message || "Unable to check approved update request.",
      });
    }
  };

  return (
    <>
      <ListPage
        title="Procurement Cases"
        subtitle="Group selected indent items into a working procurement file before tendering, empanelment, or direct purchase."
        columns={columns}
        data={rows}
        loading={loading}
        onAdd={() => navigate("/procurement-cases/new")}
        addLabel="Add Procurement Case"
        onUpdate={openProcurementCaseForUpdate}
        onSearch={setSearch}
        searchValue={search}
        selectedRows={selectedRows}
        setSelectedRows={setSelectedRows}
        showUpdate
        showRequestUpdateApproval
        onRequestUpdateApproval={requestUpdateApproval}
        showAdd={canAccessFeature(roles, "procurementCases", "create", { allowAdminOverride: false })}
        updateTooltip="Select one procurement case to open details."
        searchPlaceholder="Search case no., title, indent..."
        table={
          <ListTable
            columns={columns}
            data={rows}
            idCol="id"
            selectedRows={selectedRows}
            onRowSelect={(id) => setSelectedRows((current) => (current === id ? null : id))}
            onRowClick={(id) => navigate(`/procurement-cases/${id}`)}
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
