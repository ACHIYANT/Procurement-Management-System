import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Download, Eye } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import AppLoader from "@/components/AppLoader";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { formatCurrencyINR } from "@/lib/amount-format";
import { procurementRequest } from "@/lib/procurement-api";
import { toProcurementFileDownloadUrl, toProcurementFileViewUrl } from "@/lib/procurement-files";

const label = (value) =>
  String(value || "NA")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const money = (value) => formatCurrencyINR(value);
const summaryCardClass =
  "rounded-[20px] bg-white px-4 py-3 shadow-[0_12px_30px_-24px_rgba(0,0,0,0.35)] ring-1 ring-black/6";
const sectionShellClass =
  "rounded-[28px] bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8";

export default function CommitteeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });

  const loadMeeting = useCallback(async () => {
    try {
      setLoading(true);
      setMeeting(await procurementRequest(`/committees/${id}`));
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to fetch committee meeting." });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => loadMeeting(), 0);
    return () => clearTimeout(timer);
  }, [loadMeeting]);

  if (loading && !meeting) {
    return (
      <div className="grid min-h-full place-items-center bg-slate-100">
        <AppLoader fullScreen message="Loading committee meeting..." />
      </div>
    );
  }

  const members = Array.isArray(meeting?.members) ? meeting.members : [];
  const negotiationEntries = Array.isArray(meeting?.negotiation_entries) ? meeting.negotiation_entries : [];

  return (
    <>
      <div className="min-h-full bg-transparent px-4 py-7 text-[#1d1d1f]">
        <div className="mx-auto max-w-[1500px] space-y-5">
          <section className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 px-6 py-4 md:px-8">
            <Link to="/committees" className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to committees
            </Link>
            </div>
            <div className="px-6 py-6 md:px-8 md:py-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">Committee Meeting Detail</p>
                <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">{meeting?.meeting_no}</h1>
                <p className="mt-2 text-sm text-white/70 md:text-[15px]">
                  {label(meeting?.meeting_type)} | {meeting?.meeting_date || "NA"} | {meeting?.procurement_case?.case_no || "NA"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" className="rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]" onClick={() => navigate(`/procurement-cases/${meeting?.procurement_case?.id}`)}>
                  Open Procurement Case
                </Button>
                {meeting?.tender?.id ? (
                  <Button type="button" className="rounded-full border border-white/16 bg-white/8 text-white hover:bg-white/14" onClick={() => navigate(`/tenders/${meeting?.tender?.id}`)}>
                    Open Tender
                  </Button>
                ) : null}
              </div>
            </div>
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Members", meeting?.member_count || 0],
              ["Payment Eligible", meeting?.payment_eligible_member_count || 0],
              ["Negotiation Rows", meeting?.negotiation_entry_count || 0],
            ].map(([title, value]) => (
              <div key={title} className={summaryCardClass}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/42">{title}</p>
                <p className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-[#1d1d1f]">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
            <div className={sectionShellClass}>
              <div className="space-y-4 p-5 md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[1.4rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]">Meeting Overview</h2>
                    <p className="text-sm text-black/56">Stage, subject, forum, and linked procurement context.</p>
                  </div>
                  <div className="flex gap-2">
                    {meeting?.agenda_document_path ? (
                      <>
                        <Button asChild variant="outline" size="sm">
                          <a href={toProcurementFileViewUrl(meeting.agenda_document_path)} target="_blank" rel="noreferrer">
                            <Eye className="h-4 w-4" />
                            View Agenda
                          </a>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <a href={toProcurementFileDownloadUrl(meeting.agenda_document_path)}>
                            <Download className="h-4 w-4" />
                            Download Agenda
                          </a>
                        </Button>
                      </>
                    ) : null}
                    {meeting?.proceedings_document_path ? (
                      <>
                        <Button asChild variant="outline" size="sm">
                          <a href={toProcurementFileViewUrl(meeting.proceedings_document_path)} target="_blank" rel="noreferrer">
                            <Eye className="h-4 w-4" />
                            View Proceedings
                          </a>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <a href={toProcurementFileDownloadUrl(meeting.proceedings_document_path)}>
                            <Download className="h-4 w-4" />
                            Download
                          </a>
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 text-sm text-black/62">
                  <p><span className="font-semibold">Meeting Type:</span> {label(meeting?.meeting_type)}</p>
                  <p><span className="font-semibold">Meeting Date:</span> {meeting?.meeting_date || "NA"}</p>
                  <p><span className="font-semibold">Meeting Time:</span> {meeting?.meeting_time || "NA"}</p>
                  {meeting?.meeting_type === "negotiation_committee" ? (
                    <p><span className="font-semibold">Approval Forum:</span> {label(meeting?.approval_forum)}</p>
                  ) : null}
                  <p><span className="font-semibold">Venue:</span> {meeting?.venue || "NA"}</p>
                  <p><span className="font-semibold">Procurement Case:</span> {meeting?.procurement_case?.case_no || "NA"}</p>
                  <p><span className="font-semibold">Indent:</span> {meeting?.procurement_case?.indent?.indent_no || "NA"}</p>
                  <p><span className="font-semibold">Tender:</span> {meeting?.tender?.tender_title || "NA"}</p>
                </div>
                <div className="rounded-[22px] bg-[#f5f5f7] p-4 ring-1 ring-black/6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/42">Meeting Subject / Title</p>
                  <p className="mt-2 text-sm text-black/62">{meeting?.agenda || "No meeting subject recorded."}</p>
                </div>
              </div>
            </div>

            <div className={sectionShellClass}>
              <div className="space-y-4 p-5 md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[1.4rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]">Meeting Documents</h2>
                    <p className="text-sm text-black/56">Agenda, proceedings, and supporting meeting papers.</p>
                  </div>
                  {meeting?.attendance_document_path ? (
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <a href={toProcurementFileViewUrl(meeting.attendance_document_path)} target="_blank" rel="noreferrer">
                          <Eye className="h-4 w-4" />
                          View Attendance
                        </a>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <a href={toProcurementFileDownloadUrl(meeting.attendance_document_path)}>
                          <Download className="h-4 w-4" />
                          Download
                        </a>
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-[22px] bg-[#f5f5f7] p-4 text-sm text-black/62 ring-1 ring-black/6">
                  <p><span className="font-semibold">Location Scope:</span> {meeting?.location_scope || "NA"}</p>
                  <p className="mt-2"><span className="font-semibold">Remarks:</span> {meeting?.remarks || "NA"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className={sectionShellClass}>
            <div className="space-y-4 p-5 md:p-6">
              <h2 className="text-[1.4rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]">Committee Members and Payment</h2>
              <div className="space-y-3">
                {members.length ? members.map((member) => (
                  <div key={member.id} className="rounded-[22px] bg-[#f5f5f7] p-4 ring-1 ring-black/6">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#1d1d1f]">{member.member_name}</p>
                        <p className="text-sm text-black/56">{member.designation || "NA"} | {member.organisation_name || "NA"}</p>
                        <p className="text-xs uppercase tracking-wide text-black/42">{label(member.member_group)}</p>
                      </div>
                      <div className="text-sm text-black/62 md:text-right">
                        <p>
                          Payment:{" "}
                          {member.payment_eligible
                            ? `Eligible - ${money(member.payment_amount)} per day`
                            : "Not Eligible"}
                        </p>
                        <p>{label(member.payment_status)}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-[22px] border border-dashed border-black/12 bg-[#f5f5f7] px-4 py-6 text-sm text-black/56">
                    No members recorded for this meeting.
                  </div>
                )}
              </div>
            </div>
          </div>

          {meeting?.meeting_type === "negotiation_committee" ? (
            <div className={sectionShellClass}>
              <div className="space-y-4 p-5 md:p-6">
                <h2 className="text-[1.4rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]">Negotiation Allocation</h2>
                <div className="space-y-3">
                  {negotiationEntries.length ? negotiationEntries.map((entry) => (
                    <div key={entry.id} className="rounded-[22px] bg-[#f5f5f7] p-4 ring-1 ring-black/6">
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5 text-sm text-black/62">
                        <p><span className="font-semibold">Firm:</span> {entry.firm?.firm_name || "NA"}</p>
                        <p><span className="font-semibold">Item:</span> {entry.indent_item?.item_name || "NA"}</p>
                        <p><span className="font-semibold">Negotiated Qty:</span> {entry.negotiated_quantity || "NA"}</p>
                        <p><span className="font-semibold">Negotiated Rate:</span> {money(entry.negotiated_rate)}</p>
                        <p><span className="font-semibold">Accepted for PO:</span> {entry.accepted_for_po ? "Yes" : "No"}</p>
                        <p><span className="font-semibold">Accepted Qty:</span> {entry.accepted_quantity || "NA"}</p>
                        <p><span className="font-semibold">Accepted Rate:</span> {money(entry.accepted_rate)}</p>
                        <p><span className="font-semibold">Rank:</span> {entry.rank_order || "NA"}</p>
                        <p className="xl:col-span-2"><span className="font-semibold">Remarks:</span> {entry.remarks || "NA"}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-[22px] border border-dashed border-black/12 bg-[#f5f5f7] px-4 py-6 text-sm text-black/56">
                      No negotiation entries recorded for this meeting.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <PopupMessage open={popup.open} type={popup.type} message={popup.message} onClose={() => setPopup({ open: false, type: "info", message: "" })} />
    </>
  );
}
