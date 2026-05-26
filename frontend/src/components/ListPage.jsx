import { useEffect, useRef, useState } from "react";
import { Filter, Plus, Search } from "lucide-react";

import AppLoader from "@/components/AppLoader";
import { Button } from "@/components/ui/button";
import ListTable from "@/components/ListTable";

export default function ListPage({
  title,
  subtitle,
  columns = [],
  data = [],
  loading = false,
  onAdd,
  onUpdate,
  onRequestUpdateApproval,
  onFilter,
  actions = [],
  idCol = "id",
  onSearch,
  searchValue = "",
  selectedRows,
  setSelectedRows,
  onRowClick,
  aboveContent,
  table,
  belowContent,
  updateDisabled = false,
  updateTooltip = "Select a row to update.",
  showSearch = true,
  showAdd = true,
  addLabel = "Add",
  showUpdate = false,
  showRequestUpdateApproval = false,
  showFilter = false,
  searchPlaceholder = "Search...",
}) {
  const [internalSelected, setInternalSelected] = useState(null);
  const [renderLoader, setRenderLoader] = useState(Boolean(loading));
  const loaderStartedAtRef = useRef(0);

  const selection = selectedRows ?? internalSelected;
  const setSelection = setSelectedRows ?? setInternalSelected;
  const rows = Array.isArray(data) ? data : [];

  useEffect(() => {
    let timeoutId = null;

    if (loading) {
      loaderStartedAtRef.current = Date.now();
      timeoutId = setTimeout(() => setRenderLoader(true), 0);
    } else {
      const elapsed = Date.now() - loaderStartedAtRef.current;
      timeoutId = setTimeout(() => setRenderLoader(false), Math.max(0, 180 - elapsed));
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading]);

  const handleSelect = (id) => {
    setSelection((current) => (current === id ? null : id));
  };

  return (
    <div className="min-h-full bg-transparent px-4 py-7 text-[#1d1d1f]">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
          <div className="flex flex-col gap-5 px-6 py-6 md:px-8 md:py-7 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">
                Procurement Management System
              </p>
              <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">
                {title}
              </h1>
              {subtitle ? (
                <p className="max-w-4xl text-sm leading-6 text-white/70 md:text-[15px]">
                  {subtitle}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end xl:max-w-[52rem] xl:justify-end">
              {showSearch ? (
                <label className="relative min-w-0 sm:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/34" />
                  <input
                    type="search"
                    value={searchValue}
                    onChange={(event) => onSearch?.(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-10 w-full rounded-full border border-white/14 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-white/42 outline-none transition focus:border-[#2997ff] focus:bg-white/14 focus:ring-2 focus:ring-[#0071e3]/20"
                  />
                </label>
              ) : null}

              {showFilter ? (
                <Button type="button" variant="outline" className="h-10 rounded-full border-white/14 bg-white/8 text-white hover:bg-white/14" onClick={onFilter}>
                  <Filter className="h-4 w-4" />
                  Filter
                </Button>
              ) : null}

              {actions.map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant={action.variant || "outline"}
                  className="h-10 rounded-full border-white/14 bg-white/8 text-white hover:bg-white/14"
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}

              {showUpdate ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-full border-white/14 bg-white/8 text-white hover:bg-white/14"
                  disabled={!selection || updateDisabled}
                  title={!selection || updateDisabled ? updateTooltip : ""}
                  onClick={() => onUpdate?.(selection)}
                >
                  Update
                </Button>
              ) : null}

              {showRequestUpdateApproval ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-full border-white/14 bg-white/8 text-white hover:bg-white/14"
                  disabled={!selection}
                  title={!selection ? "Select a row to request update approval." : ""}
                  onClick={() =>
                    onRequestUpdateApproval?.(
                      selection,
                      rows.find((row) => String(row?.[idCol]) === String(selection)),
                    )
                  }
                >
                  Request Update Approval
                </Button>
              ) : null}

              {showAdd ? (
                <Button type="button" className="h-10 gap-2 rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]" onClick={onAdd}>
                  <Plus className="h-4 w-4" />
                  {addLabel}
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {aboveContent}

        <div className="relative min-h-[22rem]">
          {renderLoader ? (
            <div className="grid min-h-[22rem] place-items-center rounded-[28px] bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
              <AppLoader message="Loading records..." minHeightClass="min-h-[22rem]" />
            </div>
          ) : rows.length ? (
            table || (
              <ListTable
                columns={columns}
                data={rows}
                idCol={idCol}
                selectedRows={selection}
                onRowSelect={setSelectedRows || showUpdate ? handleSelect : undefined}
                onRowClick={onRowClick}
              />
            )
          ) : (
            <div className="grid min-h-[22rem] place-items-center rounded-[28px] bg-white p-8 text-center shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
              <div>
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#f5f5f7] text-3xl text-black/48">
                  --
                </div>
                <h2 className="mt-4 text-lg font-semibold text-[#1d1d1f]">No records found</h2>
                <p className="mt-1 text-sm text-black/56">
                  Use the Add button to create the first record.
                </p>
              </div>
            </div>
          )}
        </div>

        {belowContent}
      </div>
    </div>
  );
}
