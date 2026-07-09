import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, Clock, Search, UserRoundCheck } from "lucide-react";

import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import PopupMessage from "@/components/PopupMessage";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authRequest } from "@/lib/auth-api";
import useDebounce from "@/hooks/useDebounce";

const formatDateTime = (value) => {
  if (!value) return "NA";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "NA";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function LoginAuditLogs() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, limit: 50, offset: 0 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [empcode, setEmpcode] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const debouncedSearch = useDebounce(search, 300);
  const debouncedEmpcode = useDebounce(empcode, 300);

  const loadRows = useCallback(
    async ({ offset = 0, append = false } = {}) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: "50",
          offset: String(offset),
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (debouncedEmpcode) params.set("empcode", debouncedEmpcode);
        if (dateFrom) params.set("date_from", dateFrom);
        if (dateTo) params.set("date_to", dateTo);

        const data = await authRequest(`/login-audits?${params.toString()}`);
        setRows((current) =>
          append ? [...current, ...(data?.rows || [])] : data?.rows || [],
        );
        setMeta(data?.meta || { total: 0, limit: 50, offset });
      } catch (error) {
        setPopup({
          open: true,
          type: "error",
          message: error.message || "Unable to fetch login audit logs.",
        });
      } finally {
        setLoading(false);
      }
    },
    [dateFrom, dateTo, debouncedEmpcode, debouncedSearch],
  );

  useEffect(() => {
    loadRows({ offset: 0, append: false });
  }, [loadRows]);

  const stats = useMemo(() => {
    const uniqueUsers = new Set(rows.map((row) => row.empcode).filter(Boolean));
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = rows.filter((row) =>
      String(row.login_at || "").startsWith(today),
    ).length;
    return {
      shown: rows.length,
      total: meta.total || 0,
      uniqueUsers: uniqueUsers.size,
      todayCount,
    };
  }, [meta.total, rows]);

  const columns = [
    {
      key: "login_at",
      label: "Login Date & Time",
      render: (value) => formatDateTime(value),
    },
    {
      key: "user",
      label: "User",
      render: (value, row) => (
        <div>
          <p className="font-semibold text-slate-900">
            {value?.fullname || "Unknown"}
          </p>
          <p className="text-xs text-slate-500">
            {row.empcode || "NA"} • {value?.designation || "NA"}
          </p>
        </div>
      ),
    },
    { key: "ip_masked", label: "Encrypted IP Preview" },
    {
      key: "user_agent",
      label: "Device / Browser",
      render: (value) => (
        <span className="line-clamp-2 text-xs text-slate-600">
          {value || "NA"}
        </span>
      ),
    },
  ];

  return (
    <>
      <ListPage
        title="Login Audit Logs"
        subtitle="Review successful PMS sign-ins by user, date/time, device, and encrypted IP preview."
        columns={columns}
        data={rows}
        loading={loading}
        onSearch={setSearch}
        searchValue={search}
        searchPlaceholder="Search user, empcode, mobile..."
        showAdd={false}
        showUpdate={false}
        aboveContent={
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="border-0 shadow-lg">
                <CardContent>
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-8 w-8 text-blue-700" />
                    <div>
                      <p className="text-sm text-slate-500">Total Logs</p>
                      <p className="mt-1 text-2xl font-semibold">{stats.total}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent>
                  <div className="flex items-center gap-3">
                    <UserRoundCheck className="h-8 w-8 text-emerald-700" />
                    <div>
                      <p className="text-sm text-slate-500">Users In View</p>
                      <p className="mt-1 text-2xl font-semibold">
                        {stats.uniqueUsers}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-amber-700" />
                    <div>
                      <p className="text-sm text-slate-500">Today In View</p>
                      <p className="mt-1 text-2xl font-semibold">
                        {stats.todayCount}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Search className="h-8 w-8 text-rose-700" />
                    <div>
                      <p className="text-sm text-slate-500">Shown</p>
                      <p className="mt-1 text-2xl font-semibold">{stats.shown}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Empcode
                </span>
                <Input
                  value={empcode}
                  onChange={(event) => setEmpcode(event.target.value)}
                  placeholder="Filter exact empcode"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  From Date
                </span>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  To Date
                </span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
            </div>
          </div>
        }
        table={
          <ListTable
            columns={columns}
            data={rows}
            idCol="id"
            onLoadMore={() => loadRows({ offset: rows.length, append: true })}
            hasMore={Boolean(meta.hasMore)}
            loading={loading}
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
