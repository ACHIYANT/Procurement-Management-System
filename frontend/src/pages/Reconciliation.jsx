import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Building2,
  CircleAlert,
  Landmark,
  ReceiptIndianRupee,
} from "lucide-react";

import AppLoader from "@/components/AppLoader";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { procurementRequest } from "@/lib/procurement-api";

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });

export default function Reconciliation() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await procurementRequest("/department-funds");
        setEntries(Array.isArray(data) ? data : []);
      } catch (error) {
        setPopup({
          open: true,
          type: "error",
          message: error.message || "Unable to load reconciliation data.",
        });
      } finally {
        setLoading(false);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const departmentRows = useMemo(() => {
    const grouped = new Map();

    for (const entry of entries) {
      const departmentName = String(entry?.department_name || "Unspecified Department");
      if (!grouped.has(departmentName)) {
        grouped.set(departmentName, {
          department_name: departmentName,
          total_entries: 0,
          parked_amount: 0,
          received_amount: 0,
          vendor_payment_amount: 0,
          adjusted_amount: 0,
          refunded_amount: 0,
          carry_forward_amount: 0,
          latest_entry_date: null,
        });
      }

      const bucket = grouped.get(departmentName);
      const amount = Number(entry?.amount || 0);
      const entryDate = entry?.entry_date || null;

      bucket.total_entries += 1;
      if (entry?.entry_type === "parked") bucket.parked_amount += amount;
      if (entry?.entry_type === "received") bucket.received_amount += amount;
      if (entry?.entry_type === "vendor_payment") bucket.vendor_payment_amount += amount;
      if (entry?.entry_type === "adjusted") bucket.adjusted_amount += amount;
      if (entry?.entry_type === "refunded") bucket.refunded_amount += amount;
      if (entry?.entry_type === "carry_forward") bucket.carry_forward_amount += amount;

      if (!bucket.latest_entry_date || String(entryDate) > String(bucket.latest_entry_date)) {
        bucket.latest_entry_date = entryDate;
      }
    }

    return Array.from(grouped.values())
      .map((row) => ({
        ...row,
        net_balance:
          row.parked_amount +
          row.received_amount +
          row.carry_forward_amount -
          row.vendor_payment_amount -
          row.adjusted_amount -
          row.refunded_amount,
      }))
      .sort((left, right) =>
        String(left.department_name).localeCompare(String(right.department_name)),
      );
  }, [entries]);

  const totals = useMemo(() => {
    return departmentRows.reduce(
      (summary, row) => {
        summary.departments += 1;
        summary.totalEntries += row.total_entries;
        summary.parked += row.parked_amount;
        summary.received += row.received_amount;
        summary.vendorPayments += row.vendor_payment_amount;
        summary.balance += row.net_balance;
        if (row.net_balance !== 0) summary.openDepartments += 1;
        return summary;
      },
      {
        departments: 0,
        totalEntries: 0,
        parked: 0,
        received: 0,
        vendorPayments: 0,
        balance: 0,
        openDepartments: 0,
      },
    );
  }, [departmentRows]);

  return (
    <>
      <div className="min-h-full bg-transparent px-4 py-7 text-[#1d1d1f]">
        <div className="mx-auto max-w-[1500px] space-y-5">
          <div className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
            <div className="px-6 py-6 md:px-8 md:py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">
              Financial Tracking
            </p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">Reconciliation</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-white/70 md:text-[15px]">
              Department-wise funding view for reconciliation. Live PMS entries
              will flow here later automatically, while department fund and
              historical backfill entries are already visible here.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild className="rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]">
                <Link to="/department-funds/new">Add Department Fund Entry</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-full border-white/14 bg-white/8 text-white hover:bg-white/14"
              >
                <Link to="/department-funds/new?origin=historical_reconciliation">
                  Add Historical Entry
                </Link>
              </Button>
            </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: "Departments",
                value: totals.departments,
                icon: Building2,
              },
              {
                title: "Fund Entries",
                value: totals.totalEntries,
                icon: Landmark,
              },
              {
                title: "Parked / Received / Paid",
                value: `${money(totals.parked)} / ${money(totals.received)} / ${money(totals.vendorPayments)}`,
                icon: ReceiptIndianRupee,
              },
              {
                title: "Open Balances",
                value: `${totals.openDepartments} dept. | ${money(totals.balance)}`,
                icon: CircleAlert,
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
                  <CardContent className="space-y-3">
                    <div className="inline-flex rounded-2xl bg-[#f7fbff] p-3 text-[#0071e3] ring-1 ring-black/6">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/42">{card.title}</p>
                      <p className="mt-2 text-[1.6rem] font-semibold tracking-[-0.04em] text-[#1d1d1f]">
                        {card.value}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-[1.4rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]">Department-wise Reconciliation</h2>
                  <p className="text-sm text-black/56">
                    Clean rollup of department fund entries. This view will
                    later merge live PMS operational data automatically.
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="rounded-[24px] bg-[#f5f5f7] ring-1 ring-black/8">
                  <AppLoader message="Loading reconciliation data..." minHeightClass="min-h-[12rem]" />
                </div>
              ) : departmentRows.length ? (
                <div className="overflow-x-auto rounded-[24px] bg-white ring-1 ring-black/8">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#f5f5f7] text-[11px] uppercase tracking-[0.22em] text-black/42">
                      <tr>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Entries</th>
                        <th className="px-4 py-3">Parked</th>
                        <th className="px-4 py-3">Received</th>
                        <th className="px-4 py-3">Vendor Paid</th>
                        <th className="px-4 py-3">Adjusted</th>
                        <th className="px-4 py-3">Refunded</th>
                        <th className="px-4 py-3">Carry Forward</th>
                        <th className="px-4 py-3">Net Balance</th>
                        <th className="px-4 py-3">Latest Entry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/6">
                      {departmentRows.map((row) => (
                        <tr
                          key={row.department_name}
                          className="cursor-pointer bg-white transition hover:bg-[#fafafc]"
                          onClick={() =>
                            navigate(`/reconciliation/${encodeURIComponent(row.department_name)}`)
                          }
                        >
                          <td className="px-4 py-3 font-medium text-[#0071e3]">
                            {row.department_name}
                          </td>
                          <td className="px-4 py-3">{row.total_entries}</td>
                          <td className="px-4 py-3">{money(row.parked_amount)}</td>
                          <td className="px-4 py-3">{money(row.received_amount)}</td>
                          <td className="px-4 py-3">{money(row.vendor_payment_amount)}</td>
                          <td className="px-4 py-3">{money(row.adjusted_amount)}</td>
                          <td className="px-4 py-3">{money(row.refunded_amount)}</td>
                          <td className="px-4 py-3">{money(row.carry_forward_amount)}</td>
                          <td
                            className={`px-4 py-3 font-medium ${
                              row.net_balance === 0
                                ? "text-emerald-700"
                                : row.net_balance > 0
                                  ? "text-blue-700"
                                  : "text-rose-700"
                            }`}
                          >
                            {money(row.net_balance)}
                          </td>
                          <td className="px-4 py-3">
                            {row.latest_entry_date || "NA"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                  No reconciliation data is available yet. Add a department fund
                  entry or historical entry to begin.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={() => setPopup({ open: false, type: "info", message: "" })}
      />
    </>
  );
}
