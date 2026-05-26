import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import AppLoader from "@/components/AppLoader";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { procurementRequest } from "@/lib/procurement-api";
import { canAccessFeature, getCurrentUserRoles } from "@/lib/roles";

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

const formatQuantity = (value) => {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) return value || "0";
  return Number.isInteger(numeric) ? String(numeric) : String(numeric);
};

const summaryCardClass =
  "rounded-[20px] bg-white px-4 py-3 shadow-[0_12px_30px_-24px_rgba(0,0,0,0.35)] ring-1 ring-black/6";
const sectionShellClass =
  "rounded-[28px] bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8";
const sectionHeadingClass =
  "text-[1.55rem] font-semibold tracking-[-0.035em] text-[#1d1d1f]";
const sectionLabelClass =
  "text-[11px] font-semibold uppercase tracking-[0.26em] text-black/42";
const softPanelClass = "rounded-[24px] bg-[#f5f5f7] ring-1 ring-black/6";

export default function ProcurementCaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [roles] = useState(() => getCurrentUserRoles());
  const [procurementCase, setProcurementCase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState({
    open: false,
    type: "info",
    message: "",
  });

  const loadProcurementCase = useCallback(async () => {
    try {
      setLoading(true);
      setProcurementCase(await procurementRequest(`/procurement-cases/${id}`));
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to fetch procurement case.",
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => loadProcurementCase(), 0);
    return () => clearTimeout(timer);
  }, [loadProcurementCase]);

  if (loading && !procurementCase) {
    return (
      <div className="grid min-h-full place-items-center bg-slate-100">
        <AppLoader fullScreen message="Loading procurement case..." />
      </div>
    );
  }

  const caseItems = Array.isArray(procurementCase?.case_items)
    ? procurementCase.case_items
    : [];
  const tenders = Array.isArray(procurementCase?.tenders)
    ? procurementCase.tenders
    : [];
  const isTenderWorkflow = [
    "tender_gem",
    "tender_nic",
    "tender_split",
  ].includes(procurementCase?.procurement_mode);
  const canCreateTender = canAccessFeature(roles, "tenders", "create");

  return (
    <>
      <div className="min-h-full bg-transparent px-4 py-7 text-[#1d1d1f]">
        <div className="mx-auto max-w-[1500px] space-y-5">
          <section className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 px-6 py-4">
              <Link
                to="/procurement-cases"
                className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to procurement cases
              </Link>
            </div>

            <div className="px-6 py-5 md:px-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">
                    Procurement Case
                  </p>
                  <h1 className="mt-2 max-w-5xl text-[2.15rem] font-semibold tracking-[-0.04em] text-white md:text-[3.2rem] md:leading-[1.03]">
                    {procurementCase?.case_no}
                  </h1>
                  <p className="mt-2 max-w-4xl text-[15px] text-white/66 md:text-[17px]">
                    {procurementCase?.title}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/74">
                    <span>
                      <span className="text-white/38">Status</span>{" "}
                      <span className="font-medium text-white">
                        {label(procurementCase?.status)}
                      </span>
                    </span>
                    <span>
                      <span className="text-white/38">Mode</span>{" "}
                      <span className="font-medium text-white">
                        {label(procurementCase?.procurement_mode)}
                      </span>
                    </span>
                    <span>
                      <span className="text-white/38">Indent</span>{" "}
                      <span className="font-medium text-white">
                        {procurementCase?.indent?.system_indent_no ||
                          procurementCase?.indent?.indent_no ||
                          "NA"}
                      </span>
                    </span>
                    <span>
                      <span className="text-white/38">Location</span>{" "}
                      <span className="font-medium text-white">
                        {procurementCase?.location_scope || "NA"}
                      </span>
                    </span>
                    <span>
                      <span className="text-white/38">
                        Procurement Officer
                      </span>{" "}
                      <span className="font-medium text-white">
                        {procurementCase?.procurement_officer?.employee_name ||
                          "Unassigned"}
                      </span>
                    </span>
                    <span>
                      <span className="text-white/38">Estimated Value</span>{" "}
                      <span className="font-medium text-white">
                        {money(procurementCase?.estimated_value)}
                      </span>
                    </span>
                  </div>
                  {procurementCase?.procurement_mode === "tender_split" ? (
                    <p className="text-sm leading-6 text-white/58">
                      Split mode case. Create separate GeM and NIC tenders under
                      this procurement case when tendering begins.
                    </p>
                  ) : null}
                </div>

                <div className="shrink-0">
                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    {isTenderWorkflow && canCreateTender ? (
                      <Button
                        type="button"
                        className="rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]"
                        onClick={() =>
                          navigate(
                            `/tenders/new?procurementCaseId=${procurementCase?.id}`,
                          )
                        }
                      >
                        Create Tender
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      className="rounded-full border border-white/16 bg-white/8 text-white hover:bg-white/14"
                      onClick={() =>
                        navigate(
                          `/committees?procurementCaseId=${procurementCase?.id}`,
                        )
                      }
                    >
                      View Committees
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            {[
              [
                "Indent",
                procurementCase?.indent?.system_indent_no ||
                  procurementCase?.indent?.indent_no ||
                  "NA",
              ],
              ["Mode", label(procurementCase?.procurement_mode)],
              ["Items", procurementCase?.item_count || 0],
              ["Tenders", procurementCase?.tender_count || 0],
            ].map(([title, value]) => (
              <div key={title} className={summaryCardClass}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/42">
                  {title}
                </p>
                <p className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-[#1d1d1f]">
                  {value}
                </p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div>
              <div className={sectionShellClass}>
                <div className="border-b border-black/6 px-5 py-3.5">
                  <p className={sectionLabelClass}>Case Summary</p>
                  <h2 className="mt-1 text-[1.18rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                    Workflow and approval view
                  </h2>
                  <p className="mt-0.5 max-w-[28rem] text-[13px] leading-5 text-black/56">
                    Quick operational snapshot for status, ownership, value,
                    location, and remarks.
                  </p>
                </div>

                <div className="grid gap-px overflow-hidden rounded-b-[28px] bg-black/6 sm:grid-cols-2">
                  {[
                    ["Status", label(procurementCase?.status)],
                    [
                      "Procurement Officer",
                      procurementCase?.procurement_officer?.employee_name ||
                        "NA",
                    ],
                    ["Estimated Value", money(procurementCase?.estimated_value)],
                    ["Location", procurementCase?.location_scope || "NA"],
                  ].map(([title, value]) => (
                    <div key={title} className="bg-white px-4 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/40">
                        {title}
                      </p>
                      <p className="mt-0.5 text-sm font-medium leading-5 text-[#1d1d1f]">
                        {value}
                      </p>
                    </div>
                  ))}
                  <div className="bg-white px-4 py-2.5 sm:col-span-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/40">
                      Remarks
                    </p>
                    <p className="mt-0.5 text-sm leading-5 text-black/62">
                      {procurementCase?.remarks || "NA"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className={sectionShellClass}>
                <div className="border-b border-black/6 px-5 py-3.5">
                  <p className={sectionLabelClass}>Linked Tenders</p>
                  <h2 className="mt-1 text-[1.18rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                    Tender movement under this case
                  </h2>
                  <p className="mt-0.5 max-w-[30rem] text-[13px] leading-5 text-black/56">
                    Open any linked tender directly from here and follow the
                    next stage of case movement.
                  </p>
                </div>

                <div className="space-y-2 px-4 py-3.5 md:px-5">
                  {tenders.length ? (
                    tenders.map((tender) => (
                      <button
                        key={tender.id}
                        type="button"
                        onClick={() => navigate(`/tenders/${tender.id}`)}
                        className="w-full rounded-[18px] bg-[#f5f5f7] px-4 py-2.5 text-left ring-1 ring-black/6 transition hover:bg-[#eef6ff]"
                      >
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">
                              {tender.leg_label ? `${tender.leg_label} - ` : ""}
                              {tender.tender_title}
                            </p>
                            <p className="mt-0.5 text-[13px] leading-5 text-black/58">
                              {tender.portal_bid_no ||
                                tender.tender_reference_no ||
                                label(tender.portal_type)}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/55">
                              {label(tender.portal_type)}
                            </span>
                            {tender.allocation_quantity ? (
                              <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/55">
                                Qty {tender.allocation_quantity}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-black/12 bg-[#f5f5f7] px-4 py-6 text-sm leading-5 text-black/55">
                      {isTenderWorkflow
                        ? procurementCase?.procurement_mode === "tender_split"
                          ? "No tender is linked yet. Create separate GeM and NIC tenders for this split procurement case."
                          : "No tender is linked yet. Use the Create Tender action above when this case moves into tendering."
                        : "This procurement case follows a non-tender route, so no tender record is expected here."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className={`${sectionShellClass} overflow-hidden`}>
            <div className="border-b border-black/6 px-6 py-5">
              <p className={sectionLabelClass}>Mapped Case Items</p>
              <h2 className={`mt-2 ${sectionHeadingClass}`}>
                Items grouped under this procurement case
              </h2>
              <p className="mt-1 text-sm leading-6 text-black/58">
                These indent items now move forward together through one
                consolidated procurement case.
              </p>
            </div>

            <div className="space-y-3 px-5 py-5 md:px-6">
              {caseItems.length ? (
                caseItems.map((caseItem, index) => (
                  <div
                    key={caseItem.id}
                    className={`${softPanelClass} px-4 py-4`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/42">
                          Item {index + 1}
                        </p>
                        <h3 className="text-lg font-semibold tracking-[-0.02em] text-[#1d1d1f]">
                          {caseItem.indent_item?.item_name || "NA"}
                        </h3>
                        <p className="max-w-3xl text-sm leading-6 text-black/58">
                          {caseItem.indent_item?.specification || "NA"}
                        </p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                          {caseItem.indent_item?.category?.category_name || "Uncategorized"} /{" "}
                          {caseItem.indent_item?.subcategory?.subcategory_name || "NA"}
                        </p>
                      </div>

                      <div className="grid gap-px overflow-hidden rounded-[18px] border border-black/8 bg-black/8 sm:grid-cols-2 lg:min-w-[20rem]">
                        <div className="bg-white px-4 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/40">
                            Quantity
                          </p>
                          <p className="mt-1 text-sm font-medium text-[#1d1d1f]">
                            {formatQuantity(caseItem.indent_item?.quantity)}{" "}
                            {caseItem.indent_item?.unit || ""}
                          </p>
                        </div>
                        <div className="bg-white px-4 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/40">
                            Assigned Officer
                          </p>
                          <p className="mt-1 text-sm font-medium text-[#1d1d1f]">
                            {caseItem.indent_item?.procurement_officer
                              ?.employee_name || "Unassigned"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-black/12 bg-[#f5f5f7] px-4 py-8 text-sm text-black/55">
                  No indent items are mapped to this procurement case yet.
                </div>
              )}
            </div>
          </section>
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
