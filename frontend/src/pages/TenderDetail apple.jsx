import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  Lock,
  Trash2,
} from "lucide-react";

import AppLoader from "@/components/AppLoader";
import FieldError from "@/components/FieldError";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatCompactIndianAmount,
  formatCurrencyINR,
} from "@/lib/amount-format";
import { Input } from "@/components/ui/input";
import {
  deleteProcurement,
  patchProcurement,
  postProcurement,
  procurementRequest,
} from "@/lib/procurement-api";
import {
  toProcurementFileDownloadUrl,
  toProcurementFileViewUrl,
} from "@/lib/procurement-files";
import {
  buildRequiredErrors,
  clearFieldError,
  hasErrors,
  invalidControlClass,
} from "@/lib/form-validation";
import { canAccessFeature, getCurrentUserRoles } from "@/lib/roles";
import useDebounce from "@/hooks/useDebounce";

const money = (value) => formatCurrencyINR(value);
const compactMoney = (value) => formatCompactIndianAmount(value);

const label = (value) =>
  String(value || "NA")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const tenderReference = (tender) => {
  if (tender?.portal_type === "gem")
    return tender.portal_bid_no || "GeM Bid pending";
  if (tender?.portal_type === "nic")
    return tender.tender_reference_no || "Tender Reference No. pending";
  return label(tender?.portal_type);
};

const initialPoForm = {
  firm_id: "",
  po_no: "",
  po_date: "",
  po_value: "",
  required_pbg_amount: "",
  required_pbg_percentage: "",
};

const initialExtensionForm = {
  extended_upto_date: "",
  approval_reference: "",
  extension_reason: "",
};

const technicalStatusOptions = [
  { value: "pending", label: "Pending" },
  { value: "qualified", label: "Qualified" },
  { value: "disqualified", label: "Disqualified" },
];

const commercialStatusOptions = [
  { value: "pending", label: "Pending" },
  { value: "qualified", label: "Qualified" },
  { value: "disqualified", label: "Disqualified" },
];

const toDateTimeLocalValue = (value) => {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return `${text}T15:00`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const parseTenderDeadline = (value) => {
  if (!value) return null;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T23:59:59`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDeadline = (value) => {
  const date = parseTenderDeadline(value);
  if (!date) return "NA";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

const buildDefaultExtensionDateTime = () => {
  const now = new Date();
  now.setHours(15, 0, 0, 0);
  return toDateTimeLocalValue(now);
};

const getEffectiveDeadline = (tender) =>
  parseTenderDeadline(
    tender?.current_submission_deadline || tender?.bid_submission_date,
  );

const stepCardClass = (status) => {
  if (status === "current") return "border-blue-500 bg-blue-50 shadow-md";
  if (status === "available") return "border-amber-300 bg-amber-50";
  if (status === "completed") return "border-emerald-300 bg-emerald-50";
  return "border-slate-200 bg-slate-50 opacity-80";
};

const iconForStep = (status) => {
  if (status === "completed")
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "available")
    return <div className="h-3.5 w-3.5 rounded-full bg-amber-500" />;
  if (status === "locked") return <Lock className="h-4 w-4 text-slate-400" />;
  return <div className="h-3.5 w-3.5 rounded-full bg-blue-600" />;
};

export default function TenderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [roles] = useState(() => getCurrentUserRoles());
  const [tender, setTender] = useState(null);
  const [firms, setFirms] = useState([]);
  const [firmSearch, setFirmSearch] = useState("");
  const [selectedFirmId, setSelectedFirmId] = useState("");
  const [poForm, setPoForm] = useState(initialPoForm);
  const [extensionForm, setExtensionForm] = useState(() => ({
    ...initialExtensionForm,
    extended_upto_date: buildDefaultExtensionDateTime(),
  }));
  const [technicalForms, setTechnicalForms] = useState({});
  const [commercialForms, setCommercialForms] = useState({});
  const [vendorErrors, setVendorErrors] = useState({});
  const [poErrors, setPoErrors] = useState({});
  const [extensionErrors, setExtensionErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingVendor, setSavingVendor] = useState(false);
  const [savingPo, setSavingPo] = useState(false);
  const [savingExtension, setSavingExtension] = useState(false);
  const [savingTechnicalVendorId, setSavingTechnicalVendorId] = useState(null);
  const [savingCommercialVendorId, setSavingCommercialVendorId] =
    useState(null);
  const [deletingVendorId, setDeletingVendorId] = useState(null);
  const [popup, setPopup] = useState({
    open: false,
    type: "info",
    message: "",
  });
  const [selectedStepKey, setSelectedStepKey] = useState("bid_window");
  const debouncedFirmSearch = useDebounce(firmSearch, 350);

  const canManageTenderWorkflow = canAccessFeature(roles, "tenders", "manage");
  const canPerformOfficerTenderActions = canAccessFeature(
    roles,
    "tenders",
    "officer",
  );
  const canManageEmd = canAccessFeature(roles, "emd", "manage");

  const hydrateVendorForms = useCallback((nextTender) => {
    const vendors = Array.isArray(nextTender?.vendors)
      ? nextTender.vendors
      : [];
    setTechnicalForms(
      Object.fromEntries(
        vendors.map((vendor) => [
          vendor.id,
          {
            technical_status: vendor.technical_status || "pending",
            technical_disqualification_reason:
              vendor.technical_disqualification_reason || "",
          },
        ]),
      ),
    );
    setCommercialForms(
      Object.fromEntries(
        vendors.map((vendor) => [
          vendor.id,
          {
            commercial_status: vendor.commercial_status || "pending",
            commercial_disqualification_reason:
              vendor.commercial_disqualification_reason || "",
            final_quoted_amount: vendor.final_quoted_amount
              ? String(vendor.final_quoted_amount)
              : "",
            negotiated_amount: vendor.negotiated_amount
              ? String(vendor.negotiated_amount)
              : "",
            is_l1: Boolean(vendor.is_l1),
          },
        ]),
      ),
    );
  }, []);

  const loadTender = useCallback(async () => {
    try {
      setLoading(true);
      const data = await procurementRequest(`/tenders/${id}`);
      setTender(data);
      hydrateVendorForms(data);
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to fetch tender.",
      });
    } finally {
      setLoading(false);
    }
  }, [hydrateVendorForms, id]);

  const loadFirms = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedFirmSearch) params.set("search", debouncedFirmSearch);
    const data = await procurementRequest(`/firms?${params.toString()}`);
    setFirms(Array.isArray(data) ? data : []);
  }, [debouncedFirmSearch]);

  useEffect(() => {
    const timer = setTimeout(() => loadTender(), 0);
    return () => clearTimeout(timer);
  }, [loadTender]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadFirms().catch((error) =>
        setPopup({
          open: true,
          type: "error",
          message: error.message || "Unable to fetch firms.",
        }),
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [loadFirms]);

  const stats = useMemo(() => {
    const summary = tender?.emd_summary || {};
    return {
      totalVendors: summary.total_vendors || 0,
      emdRecords: summary.emd_records || 0,
      submitted: summary.submitted_count || 0,
      exempted: summary.exempted_count || 0,
      pending: summary.pending_count || 0,
      shortCount: summary.short_count || 0,
      requiredAmount: summary.required_amount || 0,
      submittedAmount: summary.submitted_amount || 0,
      shortAmount: summary.short_amount || 0,
    };
  }, [tender]);

  const vendors = Array.isArray(tender?.vendors) ? tender.vendors : [];
  const committees = Array.isArray(tender?.committee_meetings)
    ? tender.committee_meetings
    : [];
  const purchaseOrders = Array.isArray(tender?.purchase_orders)
    ? tender.purchase_orders
    : [];

  const effectiveDeadline = useMemo(
    () => getEffectiveDeadline(tender),
    [tender],
  );
  const isDeadlinePassed = useMemo(() => {
    if (!effectiveDeadline) return false;
    return Date.now() > effectiveDeadline.getTime();
  }, [effectiveDeadline]);
  const hasBidOpened = vendors.length > 0;
  const isBidWindowOpen = !hasBidOpened;
  const isTechnicalStepOpen = hasBidOpened || isDeadlinePassed;
  const canRecordSubmissionExtension =
    canPerformOfficerTenderActions && !hasBidOpened;

  const technicalPendingVendors = useMemo(
    () =>
      vendors.filter(
        (vendor) =>
          String(vendor?.technical_status || "").toLowerCase() === "pending",
      ),
    [vendors],
  );
  const technicalQualifiedVendors = useMemo(
    () =>
      vendors.filter(
        (vendor) =>
          String(vendor?.technical_status || "").toLowerCase() === "qualified",
      ),
    [vendors],
  );
  const technicalEvaluationComplete =
    vendors.length > 0 && technicalPendingVendors.length === 0;

  const commercialPendingVendors = useMemo(
    () =>
      technicalQualifiedVendors.filter(
        (vendor) =>
          String(vendor?.commercial_status || "").toLowerCase() === "pending",
      ),
    [technicalQualifiedVendors],
  );
  const commercialQualifiedVendors = useMemo(
    () =>
      technicalQualifiedVendors.filter(
        (vendor) =>
          String(vendor?.commercial_status || "").toLowerCase() === "qualified",
      ),
    [technicalQualifiedVendors],
  );
  const postTechnicalComplete =
    technicalEvaluationComplete && commercialPendingVendors.length === 0;

  const currentStepKey = useMemo(() => {
    if (!isTechnicalStepOpen) return "bid_window";
    if (!technicalEvaluationComplete) return "technical_evaluation";
    if (!postTechnicalComplete) return "post_technical";
    return "purchase_orders";
  }, [isTechnicalStepOpen, postTechnicalComplete, technicalEvaluationComplete]);

  const steps = useMemo(
    () =>
      [
        {
          key: "bid_window",
          title: "Bid Window",
          description:
            "Submission deadline and extension control remain active until the first vendor is added and bid opening work starts.",
        },
        {
          key: "technical_evaluation",
          title: "Technical Evaluation",
          description:
            "After the bid is opened by adding participating vendors, mark them technically qualified or disqualified.",
        },
        {
          key: "post_technical",
          title: "Post-Technical Review",
          description:
            "Record committee meetings, concerns, negotiation movement, and commercial qualification results.",
        },
        {
          key: "purchase_orders",
          title: "Purchase Orders",
          description:
            "After review completion, create POs for commercially qualified vendors only.",
        },
      ].map((step) => {
        let status = "locked";

        if (step.key === "bid_window") {
          status = hasBidOpened
            ? "completed"
            : isDeadlinePassed
              ? "available"
              : "current";
        }

        if (step.key === "technical_evaluation") {
          status = !isTechnicalStepOpen
            ? "locked"
            : technicalEvaluationComplete
              ? "completed"
              : "current";
        }

        if (step.key === "post_technical") {
          status = !technicalEvaluationComplete
            ? "locked"
            : postTechnicalComplete
              ? "completed"
              : "current";
        }

        if (step.key === "purchase_orders") {
          status = !postTechnicalComplete
            ? "locked"
            : "current";
        }

        return {
          ...step,
          status,
        };
      }),
    [
      hasBidOpened,
      isDeadlinePassed,
      isTechnicalStepOpen,
      technicalEvaluationComplete,
      postTechnicalComplete,
    ],
  );

  useEffect(() => {
    const selectedStep = steps.find((step) => step.key === selectedStepKey);
    if (!selectedStep || selectedStep.status === "locked") {
      setSelectedStepKey(currentStepKey);
    }
  }, [currentStepKey, selectedStepKey, steps]);

  const updatePo = (field) => (event) => {
    setPoForm((current) => ({ ...current, [field]: event.target.value }));
    clearFieldError(setPoErrors, field);
  };

  const updateExtension = (field) => (event) => {
    setExtensionForm((current) => ({
      ...current,
      [field]: event.target.value,
    }));
    clearFieldError(setExtensionErrors, field);
  };

  const setTechnicalField = (vendorId, field, value) => {
    setTechnicalForms((current) => ({
      ...current,
      [vendorId]: {
        ...(current[vendorId] || {}),
        [field]: value,
      },
    }));
  };

  const setCommercialField = (vendorId, field, value) => {
    setCommercialForms((current) => ({
      ...current,
      [vendorId]: {
        ...(current[vendorId] || {}),
        [field]: value,
      },
    }));
  };

  const addVendor = async (event) => {
    event.preventDefault();
    const validationErrors = selectedFirmId
      ? {}
      : { firm_id: "Select firm is required." };
    setVendorErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    setSavingVendor(true);
    try {
      await postProcurement(`/tenders/${id}/vendors`, {
        firm_id: selectedFirmId,
      });
      setSelectedFirmId("");
      setPopup({
        open: true,
        type: "success",
        message: "Firm added to tender.",
      });
      await loadTender();
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to add firm.",
      });
    } finally {
      setSavingVendor(false);
    }
  };

  const createSubmissionExtension = async (event) => {
    event.preventDefault();
    const validationErrors = buildRequiredErrors(extensionForm, [
      { name: "extended_upto_date", label: "Extended Upto Date" },
    ]);
    setExtensionErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    setSavingExtension(true);
    try {
      const data = await postProcurement(
        `/tenders/${id}/submission-extensions`,
        extensionForm,
      );
      setTender(data);
      hydrateVendorForms(data);
      setExtensionForm({
        ...initialExtensionForm,
        extended_upto_date: buildDefaultExtensionDateTime(),
      });
      setPopup({
        open: true,
        type: "success",
        message: "Tender submission extension recorded.",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to record submission extension.",
      });
    } finally {
      setSavingExtension(false);
    }
  };

  const saveTechnicalEvaluation = async (vendorId) => {
    const payload = technicalForms[vendorId] || {};
    if (
      payload.technical_status === "disqualified" &&
      !String(payload.technical_disqualification_reason || "").trim()
    ) {
      setPopup({
        open: true,
        type: "error",
        message: "Technical disqualification reason is required.",
      });
      return;
    }

    setSavingTechnicalVendorId(vendorId);
    try {
      const data = await patchProcurement(
        `/tenders/${id}/vendors/${vendorId}`,
        payload,
      );
      setTender(data);
      hydrateVendorForms(data);
      setPopup({
        open: true,
        type: "success",
        message: "Technical evaluation updated.",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to update technical evaluation.",
      });
    } finally {
      setSavingTechnicalVendorId(null);
    }
  };

  const removeVendor = async (vendor) => {
    if (!vendor?.id) return;
    const confirmed = window.confirm(
      `Do you really want to remove ${vendor?.firm?.firm_name || "this vendor"} from the tender? This will also remove the linked EMD row for this tender vendor.`,
    );
    if (!confirmed) return;

    setDeletingVendorId(vendor.id);
    try {
      const data = await deleteProcurement(`/tenders/${id}/vendors/${vendor.id}`);
      setTender(data);
      hydrateVendorForms(data);
      setPopup({
        open: true,
        type: "success",
        message: "Vendor removed from tender.",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to remove vendor from tender.",
      });
    } finally {
      setDeletingVendorId(null);
    }
  };

  const saveCommercialReview = async (vendorId) => {
    const payload = commercialForms[vendorId] || {};
    if (
      payload.commercial_status === "disqualified" &&
      !String(payload.commercial_disqualification_reason || "").trim()
    ) {
      setPopup({
        open: true,
        type: "error",
        message: "Commercial disqualification reason is required.",
      });
      return;
    }

    setSavingCommercialVendorId(vendorId);
    try {
      const data = await patchProcurement(
        `/tenders/${id}/vendors/${vendorId}`,
        payload,
      );
      setTender(data);
      hydrateVendorForms(data);
      setPopup({
        open: true,
        type: "success",
        message: "Commercial review updated.",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to update commercial review.",
      });
    } finally {
      setSavingCommercialVendorId(null);
    }
  };

  const createPo = async (event) => {
    event.preventDefault();
    const validationErrors = buildRequiredErrors(poForm, [
      { name: "firm_id", label: "Firm" },
      { name: "po_no", label: "PO No." },
      { name: "po_date", label: "PO Date" },
      { name: "po_value", label: "PO Value" },
      { name: "required_pbg_amount", label: "Required PBG Amount" },
    ]);
    setPoErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    setSavingPo(true);
    try {
      await postProcurement("/purchase-orders", {
        ...poForm,
        tender_id: id,
      });
      setPoForm(initialPoForm);
      setPopup({
        open: true,
        type: "success",
        message: "Purchase order linked with tender.",
      });
      await loadTender();
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to create PO.",
      });
    } finally {
      setSavingPo(false);
    }
  };

  if (loading && !tender) {
    return (
      <div className="grid min-h-full place-items-center bg-slate-100">
        <AppLoader fullScreen message="Loading tender..." />
      </div>
    );
  }

  const selectedStep =
    steps.find((step) => step.key === selectedStepKey) ||
    steps.find((step) => step.key === currentStepKey);

  return (
    <div className="min-h-full bg-[#f5f5f7] px-4 py-6 text-[#1d1d1f]">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
          <div className="border-b border-white/10 px-6 py-4">
            <Link
              to="/tenders"
              className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to tenders
            </Link>
          </div>
          <div className="space-y-5 px-6 py-7 md:px-8 md:py-8">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">
                Tender Workflow
              </p>
              <h1 className="max-w-5xl text-3xl font-semibold tracking-[-0.03em] md:text-[2.7rem] md:leading-[1.06]">
                {tender?.tender_title}
              </h1>
              <p className="max-w-4xl text-sm leading-6 text-white/70 md:text-[15px]">
                {tenderReference(tender)} • {label(tender?.portal_type)} •{" "}
                {tender?.location_scope}
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {[
                tender?.status ? `Status ${label(tender?.status)}` : null,
                tender?.file_no ? `File ${tender.file_no}` : null,
                tender?.procurement_case?.case_no
                  ? `Case ${tender.procurement_case.case_no}`
                  : null,
                tender?.procurement_case?.indent?.indent_no
                  ? `Indent ${tender.procurement_case.indent.indent_no}`
                  : null,
              ]
                .filter(Boolean)
                .map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/14 bg-white/6 px-3 py-1.5 text-xs font-medium text-white/84"
                  >
                    {item}
                  </span>
                ))}
            </div>

            {tender?.procurement_case ? (
              <button
                type="button"
                onClick={() =>
                  navigate(`/procurement-cases/${tender.procurement_case.id}`)
                }
                className="flex w-full flex-col gap-1 rounded-[24px] border border-white/10 bg-white/[0.045] px-4 py-3 text-left transition hover:bg-white/[0.075] md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">
                    Linked Procurement Case
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {tender.procurement_case.case_no}
                  </p>
                  <p className="mt-1 text-sm text-white/68">
                    {tender.procurement_case.title}
                  </p>
                </div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#2997ff]">
                  Open Case
                </p>
              </button>
            ) : null}
          </div>
        </section>

        <section className="grid gap-px overflow-hidden rounded-[28px] border border-black/8 bg-black/8 md:grid-cols-5">
          {[
            ["Total Vendors", stats.totalVendors],
            ["EMD Records", stats.emdRecords],
            ["Technical Pending", technicalPendingVendors.length],
            ["Commercial Pending", commercialPendingVendors.length],
            ["POs", purchaseOrders.length],
          ].map(([title, value]) => (
            <div key={title} className="bg-white px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                {title}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                {value}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-[28px] border border-black/8 bg-white shadow-[0_18px_45px_-38px_rgba(0,0,0,0.55)]">
          <div className="border-b border-black/6 px-6 py-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/42">
                  Tender Steps
                </p>
                <h2 className="mt-2 text-[1.9rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                  {selectedStep?.title}
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-black/62">
                  {selectedStep?.description}
                </p>
              </div>
              <div className="grid gap-px overflow-hidden rounded-[20px] border border-black/8 bg-black/8 text-sm sm:grid-cols-2">
                <div className="bg-[#f5f5f7] px-4 py-3 text-black/72">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/42">
                    Original Last Date
                  </p>
                  <p className="mt-1 font-medium text-[#1d1d1f]">
                    {formatDeadline(tender?.bid_submission_date)}
                  </p>
                </div>
                <div className="bg-[#f5f5f7] px-4 py-3 text-black/72">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/42">
                    Effective Last Date
                  </p>
                  <p className="mt-1 font-medium text-[#1d1d1f]">
                    {formatDeadline(
                      tender?.current_submission_deadline ||
                        tender?.bid_submission_date,
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-black/6 px-4 py-4 md:px-6">
            <div className="grid gap-2 lg:grid-cols-4">
              {steps.map((step, index) => (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => {
                    if (step.status !== "locked") {
                      setSelectedStepKey(step.key);
                    }
                  }}
                  disabled={step.status === "locked"}
                  className={`rounded-[22px] border px-4 py-3 text-left transition ${
                    selectedStepKey === step.key
                      ? "border-[#0071e3] bg-[#0071e3] text-white shadow-[0_18px_40px_-28px_rgba(0,113,227,0.75)]"
                      : step.status === "completed"
                        ? "border-emerald-200 bg-emerald-50/90 text-[#1d1d1f]"
                        : step.status === "available"
                          ? "border-amber-200 bg-amber-50/90 text-[#1d1d1f]"
                          : step.status === "locked"
                            ? "cursor-not-allowed border-black/8 bg-[#f5f5f7] text-black/38"
                            : "border-black/8 bg-white text-[#1d1d1f] hover:border-[#0071e3]/35 hover:bg-[#f7fbff]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold tracking-[-0.01em]">
                      {index + 1}. {step.title}
                    </p>
                    {selectedStepKey === step.key ? (
                      <div className="text-white">
                        {iconForStep(step.status)}
                      </div>
                    ) : (
                      iconForStep(step.status)
                    )}
                  </div>
                  <p
                    className={`mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                      selectedStepKey === step.key
                        ? "text-white/72"
                        : "text-black/45"
                    }`}
                  >
                    {step.status === "current"
                      ? "Current Step"
                      : step.status === "available"
                        ? "Open"
                        : step.status}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 md:p-6">

            {selectedStepKey === "bid_window" ? (
              <div className="space-y-4">
                {tender?.document_path ? (
                  <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">
                        Tender Document
                      </p>
                      <p className="text-sm text-slate-500">
                        Tender file is available here while the bid window
                        remains open.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline">
                        <a
                          href={toProcurementFileViewUrl(tender.document_path)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Eye className="h-4 w-4" />
                          View Document
                        </a>
                      </Button>
                      <Button asChild variant="outline">
                        <a
                          href={toProcurementFileDownloadUrl(
                            tender.document_path,
                          )}
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : null}

                {canRecordSubmissionExtension ? (
                  <form
                    className="grid gap-3 lg:grid-cols-4"
                    onSubmit={createSubmissionExtension}
                    noValidate
                  >
                    <label className="space-y-1">
                      <span className="text-sm font-medium text-slate-700">
                        Bid Extension Date and Time
                      </span>
                      <Input
                        type="datetime-local"
                        value={extensionForm.extended_upto_date}
                        onChange={updateExtension("extended_upto_date")}
                        aria-invalid={Boolean(
                          extensionErrors.extended_upto_date,
                        )}
                        className={invalidControlClass(
                          extensionErrors.extended_upto_date,
                        )}
                      />
                      <FieldError
                        message={extensionErrors.extended_upto_date}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-sm font-medium text-slate-700">
                        Approval Reference
                      </span>
                      <Input
                        value={extensionForm.approval_reference}
                        onChange={updateExtension("approval_reference")}
                        placeholder="Approval reference / note sheet no."
                      />
                    </label>
                    <label>
                      <span className="text-sm font-medium text-slate-700">
                        Reason for the extension
                      </span>
                      <Input
                        value={extensionForm.extension_reason}
                        onChange={updateExtension("extension_reason")}
                        placeholder="Reason for extension"
                      />
                    </label>
                    <Button
                      className="bg-blue-700 text-white hover:bg-blue-800"
                      disabled={savingExtension}
                    >
                      {savingExtension ? "Saving..." : "Add Extension"}
                    </Button>
                  </form>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    {hasBidOpened
                      ? "Submission extension can no longer be recorded because bid opening work has already started by adding vendors."
                      : "Submission extension can be recorded only by authorized procurement roles."}
                  </div>
                )}

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Previous Last Date</th>
                        <th className="px-4 py-3">Extended Upto</th>
                        <th className="px-4 py-3">Approval Reference</th>
                        <th className="px-4 py-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(tender?.submission_extensions || []).length ? (
                        tender.submission_extensions.map((entry) => (
                          <tr key={entry.id} className="bg-white">
                            <td className="px-4 py-3">
                              {formatDeadline(entry.previous_submission_date)}
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {formatDeadline(entry.extended_upto_date)}
                            </td>
                            <td className="px-4 py-3">
                              {entry.approval_reference || "NA"}
                            </td>
                            <td className="px-4 py-3">
                              {entry.extension_reason || "NA"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            className="px-4 py-6 text-center text-slate-500"
                            colSpan={4}
                          >
                            No submission date extension recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {selectedStepKey === "technical_evaluation" &&
            isTechnicalStepOpen ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  {canManageTenderWorkflow ? (
                    <form
                      className="grid flex-1 gap-3 md:grid-cols-[1fr_18rem_auto]"
                      onSubmit={addVendor}
                      noValidate
                    >
                      <Input
                        value={firmSearch}
                        onChange={(event) => setFirmSearch(event.target.value)}
                        placeholder="Search firm master..."
                      />
                      <label className="space-y-1">
                        <select
                          className={`h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm ${invalidControlClass(vendorErrors.firm_id)}`}
                          value={selectedFirmId}
                          onChange={(event) => {
                            setSelectedFirmId(event.target.value);
                            clearFieldError(setVendorErrors, "firm_id");
                          }}
                          aria-invalid={Boolean(vendorErrors.firm_id)}
                        >
                          <option value="">Select firm</option>
                          {firms.map((firm) => (
                            <option key={firm.id} value={firm.id}>
                              {firm.firm_name}{" "}
                              {firm.firm_code ? `(${firm.firm_code})` : ""}
                            </option>
                          ))}
                        </select>
                        <FieldError message={vendorErrors.firm_id} />
                      </label>
                      <Button
                        className="bg-blue-700 text-white hover:bg-blue-800"
                        disabled={savingVendor}
                      >
                        {savingVendor ? "Adding..." : "Add Firm"}
                      </Button>
                    </form>
                  ) : (
                    <div className="flex-1 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      Vendor participation can be reviewed here. Creation
                      changes are limited to authorized roles.
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="border-0 shadow-lg">
                    <CardContent>
                      <p className="text-sm text-slate-500">Required EMD</p>
                      <p
                        className="mt-2 text-2xl font-semibold"
                        title={money(stats.requiredAmount)}
                      >
                        {compactMoney(stats.requiredAmount)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-lg">
                    <CardContent>
                      <p className="text-sm text-slate-500">Submitted EMD</p>
                      <p
                        className="mt-2 text-2xl font-semibold"
                        title={money(stats.submittedAmount)}
                      >
                        {compactMoney(stats.submittedAmount)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card
                    className={`border-0 shadow-lg ${stats.shortAmount > 0 ? "bg-rose-50" : ""}`}
                  >
                    <CardContent>
                      <p className="text-sm text-slate-500">Short EMD</p>
                      <p
                        className={`mt-2 text-2xl font-semibold ${stats.shortAmount > 0 ? "text-rose-700" : ""}`}
                        title={money(stats.shortAmount)}
                      >
                        {compactMoney(stats.shortAmount)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">
                      Technical-Stage Committee Meetings
                    </h3>
                    <p className="text-sm text-slate-500">
                      If clarification, scrutiny, or any technical concern needs a meeting, record it here during the technical evaluation phase. Meetings recorded for this tender: {committees.length}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        navigate(
                          `/committees?procurementCaseId=${tender?.procurement_case_id || ""}&tenderId=${tender?.id}`,
                        )
                      }
                    >
                      View Committees
                    </Button>
                    {canPerformOfficerTenderActions ? (
                      <Button
                        type="button"
                        className="bg-blue-700 text-white hover:bg-blue-800"
                        onClick={() =>
                          navigate(
                            `/committees/new?procurementCaseId=${tender?.procurement_case_id || ""}&tenderId=${tender?.id}`,
                          )
                        }
                      >
                        Add Committee Meeting
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Firm</th>
                        <th className="px-4 py-3">EMD</th>
                        <th className="px-4 py-3">Technical Status</th>
                        <th className="px-4 py-3">Reason</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3 text-right">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vendors.map((vendor) => {
                        const form = technicalForms[vendor.id] || {};
                        return (
                          <tr key={vendor.id} className="bg-white align-top">
                            <td className="px-4 py-3 font-medium">
                              {vendor?.firm?.firm_name || "NA"}
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                {label(
                                  vendor?.emd_entry?.emd_submission_status ||
                                    "not_generated",
                                )}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                Short:{" "}
                                {money(vendor?.emd_summary?.short_amount)}
                              </div>
                              {vendor?.emd_entry?.id && canManageEmd ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-2"
                                  onClick={() =>
                                    navigate(`/emd/${vendor.emd_entry.id}/edit`)
                                  }
                                >
                                  Update EMD
                                </Button>
                              ) : null}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                                value={form.technical_status || "pending"}
                                onChange={(event) =>
                                  setTechnicalField(
                                    vendor.id,
                                    "technical_status",
                                    event.target.value,
                                  )
                                }
                                disabled={!canPerformOfficerTenderActions}
                              >
                                {technicalStatusOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <textarea
                                rows={2}
                                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                value={
                                  form.technical_disqualification_reason || ""
                                }
                                onChange={(event) =>
                                  setTechnicalField(
                                    vendor.id,
                                    "technical_disqualification_reason",
                                    event.target.value,
                                  )
                                }
                                disabled={!canPerformOfficerTenderActions}
                                placeholder="Required if technically disqualified"
                              />
                            </td>
                            <td className="px-4 py-3">
                              {canPerformOfficerTenderActions ? (
                                <Button
                                  className="bg-blue-700 text-white hover:bg-blue-800"
                                  disabled={
                                    savingTechnicalVendorId === vendor.id
                                  }
                                  onClick={() =>
                                    saveTechnicalEvaluation(vendor.id)
                                  }
                                >
                                  {savingTechnicalVendorId === vendor.id
                                    ? "Saving..."
                                    : "Save"}
                                </Button>
                              ) : (
                                <span className="text-xs text-slate-500">
                                  Read only
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {canManageTenderWorkflow ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                  disabled={deletingVendorId === vendor.id}
                                  onClick={() => removeVendor(vendor)}
                                  title="Remove vendor"
                                >
                                  {deletingVendorId === vendor.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {!vendors.length ? (
                        <tr>
                          <td
                            className="px-4 py-6 text-center text-slate-500"
                            colSpan={6}
                          >
                            No vendors have been recorded for this tender yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {selectedStepKey === "post_technical" ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  Record committee meetings only if any concern, clarification,
                  negotiation, or committee movement is required. Commercial
                  status should be finalized for technically qualified vendors
                  in this stage.
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">
                      Committee Meetings
                    </h3>
                    <p className="text-sm text-slate-500">
                      Meetings recorded for this tender: {committees.length}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        navigate(
                          `/committees?procurementCaseId=${tender?.procurement_case_id || ""}&tenderId=${tender?.id}`,
                        )
                      }
                    >
                      View Committees
                    </Button>
                    {canPerformOfficerTenderActions ? (
                      <Button
                        type="button"
                        className="bg-blue-700 text-white hover:bg-blue-800"
                        onClick={() =>
                          navigate(
                            `/committees/new?procurementCaseId=${tender?.procurement_case_id || ""}&tenderId=${tender?.id}`,
                          )
                        }
                      >
                        Add Committee Meeting
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Firm</th>
                        <th className="px-4 py-3">Commercial Status</th>
                        <th className="px-4 py-3">Disqualification Reason</th>
                        <th className="px-4 py-3">Final Quoted</th>
                        <th className="px-4 py-3">Negotiated</th>
                        <th className="px-4 py-3">L1</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {technicalQualifiedVendors.map((vendor) => {
                        const form = commercialForms[vendor.id] || {};
                        return (
                          <tr key={vendor.id} className="bg-white align-top">
                            <td className="px-4 py-3 font-medium">
                              {vendor?.firm?.firm_name || "NA"}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                                value={form.commercial_status || "pending"}
                                onChange={(event) =>
                                  setCommercialField(
                                    vendor.id,
                                    "commercial_status",
                                    event.target.value,
                                  )
                                }
                                disabled={!canPerformOfficerTenderActions}
                              >
                                {commercialStatusOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <textarea
                                rows={2}
                                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                value={
                                  form.commercial_disqualification_reason || ""
                                }
                                onChange={(event) =>
                                  setCommercialField(
                                    vendor.id,
                                    "commercial_disqualification_reason",
                                    event.target.value,
                                  )
                                }
                                disabled={!canPerformOfficerTenderActions}
                                placeholder="Required if commercially disqualified"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                min="0"
                                value={form.final_quoted_amount || ""}
                                onChange={(event) =>
                                  setCommercialField(
                                    vendor.id,
                                    "final_quoted_amount",
                                    event.target.value,
                                  )
                                }
                                disabled={!canPerformOfficerTenderActions}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                min="0"
                                value={form.negotiated_amount || ""}
                                onChange={(event) =>
                                  setCommercialField(
                                    vendor.id,
                                    "negotiated_amount",
                                    event.target.value,
                                  )
                                }
                                disabled={!canPerformOfficerTenderActions}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={Boolean(form.is_l1)}
                                  onChange={(event) =>
                                    setCommercialField(
                                      vendor.id,
                                      "is_l1",
                                      event.target.checked,
                                    )
                                  }
                                  disabled={!canPerformOfficerTenderActions}
                                />
                                L1
                              </label>
                            </td>
                            <td className="px-4 py-3">
                              {canPerformOfficerTenderActions ? (
                                <Button
                                  className="bg-blue-700 text-white hover:bg-blue-800"
                                  disabled={
                                    savingCommercialVendorId === vendor.id
                                  }
                                  onClick={() =>
                                    saveCommercialReview(vendor.id)
                                  }
                                >
                                  {savingCommercialVendorId === vendor.id
                                    ? "Saving..."
                                    : "Save"}
                                </Button>
                              ) : (
                                <span className="text-xs text-slate-500">
                                  Read only
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {!technicalQualifiedVendors.length ? (
                        <tr>
                          <td
                            className="px-4 py-6 text-center text-slate-500"
                            colSpan={7}
                          >
                            No technically qualified vendor is available for
                            commercial review.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {selectedStepKey === "purchase_orders" ? (
              <div className="space-y-6">
                {!commercialQualifiedVendors.length ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                    No commercially qualified vendor is available, so PO
                    creation is not open yet for this tender.
                  </div>
                ) : null}

                {canPerformOfficerTenderActions ? (
                  <form
                    className="grid gap-3 lg:grid-cols-7"
                    onSubmit={createPo}
                    noValidate
                  >
                    <label className="space-y-1">
                      <select
                        className={`h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm ${invalidControlClass(poErrors.firm_id)}`}
                        value={poForm.firm_id}
                        onChange={updatePo("firm_id")}
                        aria-invalid={Boolean(poErrors.firm_id)}
                        disabled={!commercialQualifiedVendors.length}
                      >
                        <option value="">Select firm</option>
                        {commercialQualifiedVendors.map((vendor) => (
                          <option key={vendor.id} value={vendor.firm_id}>
                            {vendor?.firm?.firm_name}
                          </option>
                        ))}
                      </select>
                      <FieldError message={poErrors.firm_id} />
                    </label>
                    <label className="space-y-1">
                      <Input
                        value={poForm.po_no}
                        onChange={updatePo("po_no")}
                        placeholder="PO No."
                        aria-invalid={Boolean(poErrors.po_no)}
                        className={invalidControlClass(poErrors.po_no)}
                      />
                      <FieldError message={poErrors.po_no} />
                    </label>
                    <label className="space-y-1">
                      <Input
                        type="date"
                        value={poForm.po_date}
                        onChange={updatePo("po_date")}
                        aria-invalid={Boolean(poErrors.po_date)}
                        className={invalidControlClass(poErrors.po_date)}
                      />
                      <FieldError message={poErrors.po_date} />
                    </label>
                    <label className="space-y-1">
                      <Input
                        type="number"
                        min="0"
                        value={poForm.po_value}
                        onChange={updatePo("po_value")}
                        placeholder="PO Value"
                        aria-invalid={Boolean(poErrors.po_value)}
                        className={invalidControlClass(poErrors.po_value)}
                      />
                      <FieldError message={poErrors.po_value} />
                    </label>
                    <label className="space-y-1">
                      <Input
                        type="number"
                        min="0"
                        value={poForm.required_pbg_amount}
                        onChange={updatePo("required_pbg_amount")}
                        placeholder="Required PBG Amount"
                        aria-invalid={Boolean(poErrors.required_pbg_amount)}
                        className={invalidControlClass(
                          poErrors.required_pbg_amount,
                        )}
                      />
                      <FieldError message={poErrors.required_pbg_amount} />
                    </label>
                    <label className="space-y-1">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={poForm.required_pbg_percentage}
                        onChange={updatePo("required_pbg_percentage")}
                        placeholder="Required PBG %"
                      />
                    </label>
                    <Button
                      className="bg-cyan-700 text-white hover:bg-cyan-800"
                      disabled={savingPo || !commercialQualifiedVendors.length}
                    >
                      {savingPo ? "Saving..." : "Create PO"}
                    </Button>
                  </form>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    Purchase order creation is available only to procurement
                    officers and admins.
                  </div>
                )}

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">PO No.</th>
                        <th className="px-4 py-3">Firm</th>
                        <th className="px-4 py-3">PO Date</th>
                        <th className="px-4 py-3">PO Value</th>
                        <th className="px-4 py-3">Required PBG</th>
                        <th className="px-4 py-3">Submitted PBG</th>
                        <th className="px-4 py-3">Short PBG</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {purchaseOrders.map((po) => (
                        <tr key={po.id} className="bg-white">
                          <td className="px-4 py-3 font-medium">{po.po_no}</td>
                          <td className="px-4 py-3">{po?.firm?.firm_name}</td>
                          <td className="px-4 py-3">{po.po_date}</td>
                          <td className="px-4 py-3">{money(po.po_value)}</td>
                          <td className="px-4 py-3">
                            {money(po?.pbg_summary?.required_amount)}
                          </td>
                          <td className="px-4 py-3">
                            {money(po?.pbg_summary?.submitted_amount)}
                          </td>
                          <td
                            className={`px-4 py-3 ${po?.pbg_summary?.is_short ? "font-semibold text-rose-700" : ""}`}
                          >
                            {money(po?.pbg_summary?.short_amount)}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                navigate(`/purchase-orders/${po.id}`)
                              }
                            >
                              Open PO
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {!purchaseOrders.length ? (
                        <tr>
                          <td
                            className="px-4 py-6 text-center text-slate-500"
                            colSpan={8}
                          >
                            No purchase order is linked with this tender yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={() => setPopup({ open: false, type: "info", message: "" })}
      />
    </div>
  );
}
