import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, UserCog, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { patchProcurement, procurementRequest } from "@/lib/procurement-api";
import { PMS_ROLES, formatRoleLabel } from "@/lib/roles";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import useDebounce from "@/hooks/useDebounce";

export default function Administration() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const debouncedSearch = useDebounce(search, 300);

  const fetchEmployeePage = useCallback(
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
      return procurementRequest(`/procurement-employees?${params.toString()}`);
    },
    [debouncedSearch, sortConfig],
  );

  const {
    rows: employees,
    loading,
    isFetchingMore,
    hasMore,
    loadMore,
    virtualStartIndex,
    error,
  } = useCursorWindowedList({
    fetchPage: fetchEmployeePage,
    deps: [debouncedSearch, sortConfig?.key, sortConfig?.direction, refreshKey],
    pageSize: 100,
    maxBufferRows: 1200,
    trimBatch: 400,
  });

  useEffect(() => {
    if (!error) return undefined;
    const timer = setTimeout(
      () =>
        setPopup({
          open: true,
          type: "error",
          message: error.message || "Unable to fetch administration data.",
        }),
      0,
    );
    return () => clearTimeout(timer);
  }, [error]);

  const toggleActive = async (employee) => {
    try {
      await patchProcurement(`/procurement-employees/${employee.id}`, {
        ...employee,
        is_active: !employee.is_active,
      });
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to update employee status." });
    }
  };

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((employee) => employee.is_active).length;
    const inactive = total - active;
    const procurementOfficers = employees.filter((employee) =>
      Array.isArray(employee.assigned_roles) && employee.assigned_roles.includes(PMS_ROLES.PROCUREMENT_OFFICER),
    ).length;
    return { total, active, inactive, procurementOfficers };
  }, [employees]);

  const columns = [
    { key: "empcode", label: "Empcode", sortable: true },
    { key: "employee_name", label: "Employee Name", sortable: true },
    { key: "designation", label: "Designation", sortable: true },
    {
      key: "assigned_roles",
      label: "Assigned Roles",
      render: (value) => {
        const roles = Array.isArray(value) ? value : [];
        if (!roles.length) return <span className="text-slate-400">No roles</span>;

        return (
          <div className="flex flex-wrap gap-1.5">
            {roles.map((role) => (
              <span
                key={role}
                className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800"
              >
                {formatRoleLabel(role)}
              </span>
            ))}
          </div>
        );
      },
    },
    { key: "division", label: "Division", sortable: true },
    { key: "mobile_no", label: "Mobile No.", sortable: true },
    { key: "location_scope", label: "Location", sortable: true },
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
    {
      key: "row_actions",
      label: "Actions",
      render: (_, row) => (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate(`/administration/procurement-employees/${row.id}/edit`)}
          >
            Edit
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => toggleActive(row)}>
            {row.is_active ? "Deactivate" : "Activate"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <ListPage
        title="Administration"
        subtitle="Manage the procurement employee master used in account activation, procurement-officer assignment, and case ownership across PMS."
        columns={columns}
        data={employees}
        loading={loading}
        onAdd={() => navigate("/administration/procurement-employees/new")}
        addLabel="Add Employee"
        onUpdate={(id) => navigate(`/administration/procurement-employees/${id}/edit`)}
        onSearch={setSearch}
        searchValue={search}
        selectedRows={selectedEmployeeId}
        setSelectedRows={setSelectedEmployeeId}
        showUpdate
        updateTooltip="Select one employee to open edit form."
        searchPlaceholder="Search employee, empcode, division..."
        aboveContent={
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-0 shadow-lg"><CardContent><div className="flex items-center gap-3"><Users className="h-8 w-8 text-blue-700" /><div><p className="text-sm text-slate-500">Total Employees</p><p className="mt-1 text-2xl font-semibold">{stats.total}</p></div></div></CardContent></Card>
            <Card className="border-0 shadow-lg"><CardContent><div className="flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-emerald-700" /><div><p className="text-sm text-slate-500">Active</p><p className="mt-1 text-2xl font-semibold">{stats.active}</p></div></div></CardContent></Card>
            <Card className="border-0 shadow-lg"><CardContent><div className="flex items-center gap-3"><UserCog className="h-8 w-8 text-amber-700" /><div><p className="text-sm text-slate-500">Procurement Officers</p><p className="mt-1 text-2xl font-semibold">{stats.procurementOfficers}</p></div></div></CardContent></Card>
            <Card className="border-0 shadow-lg"><CardContent><div className="flex items-center gap-3"><Users className="h-8 w-8 text-rose-700" /><div><p className="text-sm text-slate-500">Inactive</p><p className="mt-1 text-2xl font-semibold">{stats.inactive}</p></div></div></CardContent></Card>
          </div>
        }
        table={
          <ListTable
            columns={columns}
            data={employees}
            idCol="id"
            selectedRows={selectedEmployeeId}
            onRowSelect={(id) => setSelectedEmployeeId((current) => (current === id ? null : id))}
            onRowClick={(id) => navigate(`/administration/procurement-employees/${id}/edit`)}
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
