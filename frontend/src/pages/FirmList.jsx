import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import PopupMessage from "@/components/PopupMessage";
import { procurementRequest } from "@/lib/procurement-api";
import { canAccessFeature, getCurrentUserRoles } from "@/lib/roles";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import useDebounce from "@/hooks/useDebounce";

export default function FirmList() {
  const navigate = useNavigate();
  const [roles] = useState(() => getCurrentUserRoles());
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const debouncedSearch = useDebounce(search, 350);

  const fetchFirmPage = useCallback(
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

      return procurementRequest(`/firms?${params.toString()}`);
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
    fetchPage: fetchFirmPage,
    deps: [debouncedSearch, sortConfig?.key, sortConfig?.direction],
    pageSize: 100,
    maxBufferRows: 1200,
    trimBatch: 400,
  });

  useEffect(() => {
    if (!error) return undefined;

    const timer = setTimeout(() => {
      setPopup({ open: true, type: "error", message: error.message || "Unable to fetch firms." });
    }, 0);

    return () => clearTimeout(timer);
  }, [error]);

  const columns = [
    { key: "firm_code", label: "Firm Code", sortable: true },
    { key: "firm_name", label: "Firm Name", sortable: true },
    { key: "vendor_category", label: "Firm Category", sortable: true },
    { key: "vendor_type", label: "Firm Type", sortable: true },
    {
      key: "primary_contact_person",
      label: "Primary Contact",
      render: (value, row) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-800">{value || "NA"}</span>
          <span className="text-xs text-slate-500">{row.primary_contact_value || "No contact"}</span>
        </div>
      ),
    },
    { key: "primary_address_label", label: "Primary Address" },
    { key: "address_count", label: "Addresses" },
    { key: "contact_count", label: "Contacts" },
    {
      key: "is_active",
      label: "Status",
      render: (value) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
            value ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
          }`}
        >
          {value ? "Active" : "Inactive"}
        </span>
      ),
    },
    { key: "gst_no", label: "GST No.", sortable: true },
  ];

  return (
    <>
      <ListPage
        title="Firm Master"
        subtitle="View all firms first, then use Add Firm to create reusable firm master records with addresses and contacts."
        columns={columns}
        data={rows}
        loading={loading}
        onAdd={() => navigate("/firms/new")}
        addLabel="Add Firm"
        onSearch={setSearch}
        searchValue={search}
        showFilter={false}
        showAdd={canAccessFeature(roles, "firms", "create")}
        searchPlaceholder="Search firm, code, type, GST, PAN..."
        table={
          <ListTable
            columns={columns}
            data={rows}
            idCol="id"
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
