import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import PopupMessage from "@/components/PopupMessage";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrencyINR } from "@/lib/amount-format";
import { procurementRequest } from "@/lib/procurement-api";
import useDebounce from "@/hooks/useDebounce";

const label = (value) =>
  String(value || "NA")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

export default function CommitteeAttendanceReport() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const debouncedSearch = useDebounce(search, 350);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const data = await procurementRequest(`/committees/reports/member-attendance?${params.toString()}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to fetch member payment report." });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, debouncedSearch]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <>
      <div className="min-h-full bg-slate-100 px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-[32px] bg-black px-6 py-6 text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)] md:px-8 md:py-7">
            <Link to="/committees" className="mb-4 inline-flex items-center gap-2 text-sm text-white/72">
              <ArrowLeft className="h-4 w-4" />
              Back to committees
            </Link>
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">Committee Report</p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] md:text-[2.35rem]">Member Payment Report</h1>
            <p className="mt-2 text-sm leading-6 text-white/70 md:text-[15px]">Track member-wise meeting days and generate committee payment on a unique per-day basis for eligible members.</p>
          </div>

          <Card className="border-0 shadow-xl">
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_11rem_11rem]">
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search member, designation, organisation..." />
                <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              </div>
              <div className="space-y-4">
                {!loading && rows.length ? rows.map((row, index) => (
                  <div key={`${row.member_name}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-950">{row.member_name}</p>
                        <p className="mt-1 text-sm text-slate-600">{row.designation} | {row.organisation_name}</p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{label(row.member_group)}</p>
                      </div>
                      <div className="grid gap-2 text-sm text-slate-700 md:text-right">
                        <p>Meeting Rows: <span className="font-semibold">{row.attendance_count}</span></p>
                        <p>Meeting Days: <span className="font-semibold">{row.meeting_day_count}</span></p>
                        <p>Payable Days: <span className="font-semibold">{row.payment_day_count}</span></p>
                        <p>Total Payment: <span className="font-semibold">{formatCurrencyINR(row.payment_amount_total)}</span></p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {row.meetings.map((meeting) => (
                        <div key={`${meeting.committee_meeting_id}-${meeting.meeting_date}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          <p className="font-medium text-slate-900">
                            {meeting.meeting_no} | {label(meeting.meeting_type)} | {meeting.meeting_date}
                          </p>
                          <p className="mt-1 text-slate-600">
                            Case {meeting.procurement_case_no} | Indent {meeting.indent_no} | {meeting.tender_title}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                            Payment {formatCurrencyINR(meeting.payment_amount)} | {meeting.payment_counted_for_day ? "Counted For Day" : "Not Counted Again"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                    {loading ? "Loading member payment report..." : "No eligible technical or purchase committee members found."}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <PopupMessage open={popup.open} type={popup.type} message={popup.message} onClose={() => setPopup({ open: false, type: "info", message: "" })} />
    </>
  );
}
