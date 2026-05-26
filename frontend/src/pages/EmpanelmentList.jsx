import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import PopupMessage from "@/components/PopupMessage";
import { procurementRequest } from "@/lib/procurement-api";
import { canAccessFeature, getCurrentUserRoles } from "@/lib/roles";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import useDebounce from "@/hooks/useDebounce";

const label = (value) =>
  String(value || "NA")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const statusChipMap = {
  active: { color: "green" },
  extended: { color: "blue" },
  expired: { color: "yellow" },
  inactive: { color: "gray" },
};

function CategoryPills(_, row) {
  const labels = Array.isArray(row.category_labels) ? row.category_labels : [];
  if (!labels.length) return <span className="text-slate-400">No categories</span>;

  return (
    <div className="flex max-w-[24rem] flex-wrap gap-1.5">
      {labels.slice(0, 3).map((item) => (
        <span key={item} className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          {item}
        </span>
      ))}
      {labels.length > 3 ? (
        <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          +{labels.length - 3} more
        </span>
      ) : null}
    </div>
  );
}

export default function EmpanelmentList() {
  const navigate = useNavigate();
  const [roles] = useState(() => getCurrentUserRoles());
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [selectedRows, setSelectedRows] = useState(null);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const debouncedSearch = useDebounce(search, 350);

  const fetchPage = useCallback(
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
      return procurementRequest(`/empanelments?${params.toString()}`);
    },
    [debouncedSearch, sortConfig],
  );

  const { rows, loading, isFetchingMore, hasMore, loadMore, virtualStartIndex, error } =
    useCursorWindowedList({
      fetchPage,
      deps: [debouncedSearch, sortConfig?.key, sortConfig?.direction],
      pageSize: 100,
      maxBufferRows: 1200,
      trimBatch: 400,
    });

  useEffect(() => {
    if (!error) return undefined;
    const timer = setTimeout(() => {
      setPopup({ open: true, type: "error", message: error.message || "Unable to fetch empanelments." });
    }, 0);
    return () => clearTimeout(timer);
  }, [error]);

  const columns = [
    { key: "empanelment_no", label: "Empanelment No.", sortable: true },
    { key: "firm.firm_name", label: "Firm" },
    { key: "valid_from", label: "Valid From", sortable: true },
    { key: "current_valid_upto", label: "Current Valid Upto", sortable: true, sortKey: "current_valid_upto" },
    {
      key: "effective_status",
      label: "Status",
      chipMap: statusChipMap,
      format: label,
      sortable: true,
    },
    { key: "category_count", label: "Categories" },
    { key: "oem_count", label: "OEMs" },
    { key: "extension_count", label: "Extensions" },
    { key: "category_labels", label: "Item Categories", render: CategoryPills },
  ];

  return (
    <>
      <ListPage
        title="Empanelment Management"
        subtitle="Track firm-wise empanelment validity, item categories, OEM coverage, and extension history."
        columns={columns}
        data={rows}
        loading={loading}
        onAdd={() => navigate("/empanelments/new")}
        addLabel="Add Empanelment"
        onUpdate={(id) => navigate(`/empanelments/${id}`)}
        onSearch={setSearch}
        searchValue={search}
        selectedRows={selectedRows}
        setSelectedRows={setSelectedRows}
        showUpdate
        showAdd={canAccessFeature(roles, "empanelments", "create")}
        updateTooltip="Select one empanelment to open details."
        searchPlaceholder="Search empanelment no., firm, status..."
        table={
          <ListTable
            columns={columns}
            data={rows}
            idCol="id"
            selectedRows={selectedRows}
            onRowSelect={(id) => setSelectedRows((current) => (current === id ? null : id))}
            onRowClick={(id) => navigate(`/empanelments/${id}`)}
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
