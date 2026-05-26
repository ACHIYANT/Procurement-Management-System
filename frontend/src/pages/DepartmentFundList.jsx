import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import PopupMessage from "@/components/PopupMessage";
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

export default function DepartmentFundList() {
  const navigate = useNavigate();
  const [roles] = useState(() => getCurrentUserRoles());
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState(null);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const debouncedSearch = useDebounce(search, 350);

  const fetchDepartmentFundPage = useCallback(
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
      return procurementRequest(`/department-funds?${params.toString()}`);
    },
    [debouncedSearch, sortConfig],
  );

  const {
    rows: cursorRows,
    loading: cursorLoading,
    isFetchingMore,
    hasMore,
    loadMore,
    virtualStartIndex,
    error,
  } = useCursorWindowedList({
    fetchPage: fetchDepartmentFundPage,
    deps: [debouncedSearch, sortConfig?.key, sortConfig?.direction],
    pageSize: 100,
    maxBufferRows: 1200,
    trimBatch: 400,
  });

  useEffect(() => {
    setRows(cursorRows);
    setLoading(cursorLoading);
  }, [cursorLoading, cursorRows]);

  useEffect(() => {
    if (!error) return undefined;
    const timer = setTimeout(() => {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to fetch department fund entries.",
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [error]);

  const columns = [
    { key: "department_name", label: "Department", sortable: true },
    { key: "subject", label: "Subject", sortable: true },
    { key: "entry_type", label: "Entry Type", format: label, sortable: true },
    { key: "entry_origin", label: "Origin", format: label, sortable: true },
    { key: "amount", label: "Amount", format: money, sortable: true },
    { key: "entry_date", label: "Entry Date", sortable: true },
    { key: "reference_no", label: "Reference", sortable: true },
    { key: "financial_year", label: "FY", sortable: true },
  ];

  return (
    <>
      <ListPage
        title="Department Funds"
        subtitle="Capture department-side fund movements once here. Live PMS procurement records will later feed reconciliation automatically."
        columns={columns}
        data={rows}
        loading={loading}
        onAdd={() => navigate("/department-funds/new")}
        addLabel="Add Fund Entry"
        onSearch={setSearch}
        searchValue={search}
        selectedRows={selectedRows}
        setSelectedRows={setSelectedRows}
        searchPlaceholder="Search department, subject, reference..."
        showAdd={canAccessFeature(roles, "departmentFunds", "create")}
        table={
          <ListTable
            columns={columns}
            data={rows}
            idCol="id"
            selectedRows={selectedRows}
            onRowSelect={(id) => setSelectedRows((current) => (current === id ? null : id))}
            onRowClick={(id) => setSelectedRows((current) => (current === id ? null : id))}
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
