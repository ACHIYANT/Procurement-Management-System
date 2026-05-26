import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  Loader2,
  Lock,
  Trash2,
} from "lucide-react";

import AppLoader from "@/components/AppLoader";
import FieldError from "@/components/FieldError";
import FileAttachmentField from "@/components/FileAttachmentField";
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
  uploadProcurementFile,
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

const pbgStatusLabel = (value) => {
  switch (String(value || "").toLowerCase()) {
    case "ok":
      return "OK";
    case "short_amount":
      return "Short in Amount";
    case "short_validity":
      return "Short in Validity";
    case "both":
      return "Short in Amount and Validity";
    default:
      return label(value);
  }
};

const getPbgReceiptEndDate = (receipt) => {
  const dates = [
    receipt?.valid_upto,
    receipt?.claim_period_upto,
    receipt?.invocation_upto,
  ]
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()));
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((value) => value.getTime())))
    .toISOString()
    .slice(0, 10);
};

const asPositiveAmount = (value) => {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const normalizeNumericInputValue = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return Number.isInteger(numeric) ? String(numeric) : String(numeric);
};

const formatPlainNumber = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return "Not entered";
  if (Number.isInteger(numeric)) {
    return numeric.toLocaleString("en-IN");
  }
  return numeric.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const buildCommercialItemQuotes = (vendor, tenderItems = []) => {
  const savedQuotes = Array.isArray(vendor?.commercial_item_quotes)
    ? vendor.commercial_item_quotes
    : [];
  const savedQuoteByItemId = new Map(
    savedQuotes.map((quote) => [Number(quote.tender_item_id), quote]),
  );

  return tenderItems.map((item) => {
    const savedQuote = savedQuoteByItemId.get(Number(item.id));
    return {
      tender_item_id: item.id,
      quoted_amount: savedQuote?.quoted_amount
        ? String(savedQuote.quoted_amount)
        : "",
      negotiated_amount: savedQuote?.negotiated_amount
        ? String(savedQuote.negotiated_amount)
        : "",
      loa_allocated_quantity: savedQuote?.loa_allocated_quantity
        ? normalizeNumericInputValue(savedQuote.loa_allocated_quantity)
        : "",
      loa_allocated_amount: savedQuote?.loa_allocated_amount
        ? String(savedQuote.loa_allocated_amount)
        : "",
      make: savedQuote?.make || "",
      model: savedQuote?.model || "",
      remarks: savedQuote?.remarks || "",
    };
  });
};

const getTenderItemDisplayName = (item, index) => {
  const category = item?.indent_item?.category?.category_name;
  const subcategory = item?.indent_item?.subcategory?.subcategory_name;
  const itemName = item?.indent_item?.item_name;
  if (category || subcategory) {
    return [category, subcategory].filter(Boolean).join(" / ");
  }
  return itemName || `Item ${index + 1}`;
};

const GST_OPTIONS = ["5", "18", "40"];

const calculatePoItemTotalAmount = (item) => {
  const quantity = Number(item?.quantity || 0);
  const unitRate = Number(item?.unit_rate || 0);
  const gstPercentage = Number(item?.gst_percentage || 0);
  const taxableAmount = quantity * unitRate;
  const totalAmount = taxableAmount + (taxableAmount * gstPercentage) / 100;
  return Number.isFinite(totalAmount) ? totalAmount : 0;
};

const buildBasePoItemForms = (tenderItems = []) =>
  tenderItems.map((item) => {
    const indentItem = item?.indent_item || {};
    return {
      tender_item_id: item.id,
      indent_item_id: item.indent_item_id || indentItem.id || "",
      item_name: indentItem.item_name || "PO Item",
      item_description: indentItem.specification || "",
      quantity: item.tender_quantity ? String(item.tender_quantity) : "",
      unit: item.unit || indentItem.unit || "",
      make: "",
      model: "",
      unit_rate: "",
      gst_percentage: "",
      installation_required: true,
      remarks: "",
    };
  });

const sumPurchaseOrderItemQuantityByTenderItem = (purchaseOrders = []) => {
  const usage = new Map();
  purchaseOrders.forEach((purchaseOrder) => {
    (Array.isArray(purchaseOrder?.items) ? purchaseOrder.items : []).forEach(
      (item) => {
        const tenderItemId = Number(item?.tender_item_id);
        if (!tenderItemId) return;
        usage.set(
          tenderItemId,
          (usage.get(tenderItemId) || 0) + asPositiveAmount(item?.quantity || 0),
        );
      },
    );
  });
  return usage;
};

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
  po_quantity: "",
  warranty_years: "",
  warranty_months: "",
  warranty_start_date: "",
  po_document_path: "",
};

const initialExtensionForm = {
  extended_upto_date: "",
  approval_reference: "",
  extension_reason: "",
};

const buildAllocationExtensionItems = (tenderItems = []) =>
  tenderItems.map((item) => ({
    tender_item_id: item.id,
    extension_quantity: "",
    extension_amount: "",
  }));

const initialTenderPbgSetupForm = {
  pbg_mode: "po_wise",
  additional_claim_months: "6",
  remarks: "",
};

const initialPbgReceiptForm = {
  firm_id: "",
  po_id: "",
  pbg_amount: "",
  submission_mode: "bank_guarantee",
  status: "active",
  bank_guarantee_no: "",
  issuing_bank_name: "",
  issue_date: "",
  valid_upto: "",
  claim_period_upto: "",
  invocation_upto: "",
  document_path: "",
  refund_status: "held",
  remarks: "",
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

const loaRcIssueOptions = [
  { value: "not_issued", label: "Not issued" },
  { value: "loa_issued", label: "LOA issued" },
  { value: "rc_issued", label: "RC issued" },
];

const buildWarrantyPeriod = ({ warranty_years, warranty_months }) => {
  const years = Number(warranty_years || 0);
  const months = Number(warranty_months || 0);
  return [
    years > 0 ? `${years} ${years === 1 ? "year" : "years"}` : "",
    months > 0 ? `${months} ${months === 1 ? "month" : "months"}` : "",
  ]
    .filter(Boolean)
    .join(" ");
};

const parseWarrantyMonths = (value) => {
  const text = String(value || "").toLowerCase();
  const yearMatch = text.match(/(\d+(?:\.\d+)?)\s*years?/);
  const monthMatch = text.match(/(\d+(?:\.\d+)?)\s*months?/);
  return Math.round(Number(yearMatch?.[1] || 0) * 12 + Number(monthMatch?.[1] || 0));
};

const addMonths = (value, months) => {
  if (!value || !months) return value ? new Date(value) : null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setMonth(date.getMonth() + Number(months || 0));
  return date;
};

const formatDate = (value) => {
  if (!value) return "NA";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "NA";
  return date.toISOString().slice(0, 10);
};

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

const tableShellClass =
  "overflow-x-auto rounded-[24px] border border-black/8 bg-white";
const sectionShellClass =
  "rounded-[28px] bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8";
const mutedPanelClass =
  "rounded-[24px] border border-black/8 bg-[#f5f5f7] px-4 py-4";
const dashedPanelClass =
  "rounded-[24px] border border-dashed border-black/12 bg-[#f5f5f7] px-4 py-4 text-sm text-black/55";
const primaryButtonClass =
  "rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]";
const lightButtonClass =
  "rounded-full border-black/10 bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]";
const sectionMiniHeadingClass =
  "text-[11px] font-semibold uppercase tracking-[0.24em] text-black/42";
const tableHeadClass =
  "bg-[#f5f5f7] text-[11px] uppercase tracking-[0.22em] text-black/42";
const stickyFirstHeadClass = `${tableHeadClass} sticky left-0 z-30 overflow-hidden bg-[#f6f7fb]`;
const stickyFirstCellClass =
  "sticky left-0 z-20 overflow-hidden bg-white";
const stickySecondHeadClass =
  `${tableHeadClass} sticky left-[4.5rem] z-20 overflow-hidden bg-[#f6f7fb]`;
const stickySecondCellClass =
  "sticky left-[4.5rem] z-10 overflow-hidden bg-white";
const compactSelectClass =
  "h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-[#1d1d1f]";
const compactTextareaClass =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-[#1d1d1f]";

export default function TenderDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [roles] = useState(() => getCurrentUserRoles());
  const [tender, setTender] = useState(null);
  const [firms, setFirms] = useState([]);
  const [firmSearch, setFirmSearch] = useState("");
  const [selectedFirmId, setSelectedFirmId] = useState("");
  const [poForm, setPoForm] = useState(initialPoForm);
  const [poItemForms, setPoItemForms] = useState([]);
  const [extensionForm, setExtensionForm] = useState(() => ({
    ...initialExtensionForm,
    extended_upto_date: buildDefaultExtensionDateTime(),
  }));
  const [technicalForms, setTechnicalForms] = useState({});
  const [commercialForms, setCommercialForms] = useState({});
  const [negotiationForms, setNegotiationForms] = useState({});
  const [allocationBasis, setAllocationBasis] = useState("quantity");
  const [allocationScope, setAllocationScope] = useState("overall");
  const [loaRcIssueType, setLoaRcIssueType] = useState("not_issued");
  const [selectedLoaRcVendorIds, setSelectedLoaRcVendorIds] = useState([]);
  const [loaRcVendorPicker, setLoaRcVendorPicker] = useState("");
  const [allocationExtensionForms, setAllocationExtensionForms] = useState({});
  const [pbgSetupForms, setPbgSetupForms] = useState({});
  const [tenderPbgSetupForm, setTenderPbgSetupForm] = useState(
    initialTenderPbgSetupForm,
  );
  const [pbgReceiptForm, setPbgReceiptForm] = useState(initialPbgReceiptForm);
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
  const [savingVendorItemDetailsId, setSavingVendorItemDetailsId] =
    useState(null);
  const [savingNegotiationVendorId, setSavingNegotiationVendorId] =
    useState(null);
  const [savingLoaVendorId, setSavingLoaVendorId] = useState(null);
  const [savingLoaRcVendorId, setSavingLoaRcVendorId] = useState(null);
  const [savingAllocationExtensionVendorId, setSavingAllocationExtensionVendorId] =
    useState(null);
  const [savingPbgSetupVendorId, setSavingPbgSetupVendorId] = useState(null);
  const [savingTenderPbgSetup, setSavingTenderPbgSetup] = useState(false);
  const [savingPbgReceipt, setSavingPbgReceipt] = useState(false);
  const [deletingVendorId, setDeletingVendorId] = useState(null);
  const [openVendorItemEditors, setOpenVendorItemEditors] = useState({});
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
    const nextTenderItems = Array.isArray(nextTender?.items) ? nextTender.items : [];
    const pbgEngine = nextTender?.pbg_engine || {};
    const pbgSetup = pbgEngine?.setup || {};
    const pbgProfiles = Array.isArray(pbgEngine?.vendor_profiles)
      ? pbgEngine.vendor_profiles
      : [];
    const pbgProfileByVendorId = new Map(
      pbgProfiles.map((profile) => [Number(profile.vendor_id), profile]),
    );
    setTechnicalForms(
      Object.fromEntries(
        vendors.map((vendor) => [
          vendor.id,
          {
            technical_status: vendor.technical_status || "pending",
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
            final_quoted_amount: vendor.final_quoted_amount
              ? String(vendor.final_quoted_amount)
              : "",
            commercial_item_quotes: buildCommercialItemQuotes(
              vendor,
              nextTenderItems,
            ),
          },
        ]),
      ),
    );
    setNegotiationForms(
      Object.fromEntries(
        vendors.map((vendor) => [
          vendor.id,
          {
            negotiated_amount: vendor.negotiated_amount
              ? String(vendor.negotiated_amount)
              : "",
            loa_allocated_quantity: vendor.loa_allocated_quantity
              ? String(vendor.loa_allocated_quantity)
              : "",
            loa_allocated_amount: vendor.loa_allocated_amount
              ? String(vendor.loa_allocated_amount)
              : "",
            loa_rc_issue_date: vendor.loa_rc_issue_date || "",
            loa_rc_document_path: vendor.loa_rc_document_path || "",
          },
        ]),
      ),
    );
    setAllocationExtensionForms(
      Object.fromEntries(
        vendors.map((vendor) => [
          vendor.id,
          {
            approval_reference: "",
            approval_date: "",
            document_path: "",
            remarks: "",
            items: buildAllocationExtensionItems(nextTenderItems),
          },
        ]),
      ),
    );
    setPbgSetupForms(
      Object.fromEntries(
        vendors.map((vendor) => [
          vendor.id,
          {
            pbg_percentage:
              pbgProfileByVendorId.get(Number(vendor.id))?.pbg_percentage ||
              vendor.pbg_percentage
                ? String(
                    pbgProfileByVendorId.get(Number(vendor.id))?.pbg_percentage ??
                      vendor.pbg_percentage,
                  )
                : "",
          },
        ]),
      ),
    );
    setTenderPbgSetupForm({
      pbg_mode: pbgSetup?.pbg_mode || "po_wise",
      additional_claim_months:
        pbgSetup?.additional_claim_months !== null &&
        pbgSetup?.additional_claim_months !== undefined
          ? String(pbgSetup.additional_claim_months)
          : "6",
      remarks: pbgSetup?.remarks || "",
    });
    setPbgReceiptForm((current) => ({
      ...initialPbgReceiptForm,
      firm_id: current.firm_id || "",
      po_id: "",
      submission_mode: current.submission_mode || "bank_guarantee",
      status: current.status || "active",
      refund_status: current.refund_status || "held",
    }));
    const storedAllocationBasis = vendors.find(
      (vendor) => vendor?.loa_allocation_basis,
    )?.loa_allocation_basis;
    setAllocationBasis(storedAllocationBasis || "quantity");
    setAllocationScope(nextTender?.loa_allocation_scope || "overall");
    const issuedVendor = vendors.find((vendor) =>
      ["loa_issued", "rc_issued"].includes(vendor?.loa_rc_issue_type),
    );
    setLoaRcIssueType(issuedVendor?.loa_rc_issue_type || "not_issued");
    setSelectedLoaRcVendorIds(
      vendors
        .filter((vendor) =>
          ["loa_issued", "rc_issued"].includes(vendor?.loa_rc_issue_type),
        )
        .map((vendor) => String(vendor.id)),
    );
    setLoaRcVendorPicker("");
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

  const tenderItems = useMemo(
    () => (Array.isArray(tender?.items) ? tender.items : []),
    [tender],
  );
  const vendors = Array.isArray(tender?.vendors) ? tender.vendors : [];
  const committees = Array.isArray(tender?.committee_meetings)
    ? tender.committee_meetings
    : [];
  const purchaseOrders = Array.isArray(tender?.purchase_orders)
    ? tender.purchase_orders
    : [];
  const basePoItemForms = useMemo(
    () => buildBasePoItemForms(tenderItems),
    [tenderItems],
  );

  useEffect(() => {
    setPoItemForms(basePoItemForms);
  }, [basePoItemForms]);

  useEffect(() => {
    if (!poForm.firm_id) return;
    const selectedVendor = vendors.find(
      (vendor) => Number(vendor.firm_id) === Number(poForm.firm_id),
    );
    const selectedVendorQuotes = Array.isArray(
      selectedVendor?.commercial_item_quotes,
    )
      ? selectedVendor.commercial_item_quotes
      : commercialForms[selectedVendor?.id]?.commercial_item_quotes || [];
    const quoteByTenderItemId = new Map(
      selectedVendorQuotes.map((quote) => [Number(quote.tender_item_id), quote]),
    );
    const extensionByItem = new Map();
    const extensionAmountByItem = new Map();
    (selectedVendor?.allocation_extensions || []).forEach((entry) => {
      (Array.isArray(entry?.items) ? entry.items : []).forEach((item) => {
        const tenderItemId = Number(item?.tender_item_id);
        if (!tenderItemId) return;
        extensionByItem.set(
          tenderItemId,
          Number(extensionByItem.get(tenderItemId) || 0) +
            Number(item?.extension_quantity || 0),
        );
        extensionAmountByItem.set(
          tenderItemId,
          Number(extensionAmountByItem.get(tenderItemId) || 0) +
            Number(item?.extension_amount || 0),
        );
      });
    });

    const vendorPurchaseOrders = purchaseOrders.filter(
      (purchaseOrder) =>
        Number(purchaseOrder?.firm_id) === Number(selectedVendor?.firm_id),
    );
    const existingUsageByTenderItem =
      sumPurchaseOrderItemQuantityByTenderItem(vendorPurchaseOrders);
    const allocationBasis = String(
      selectedVendor?.loa_allocation_basis || "",
    ).toLowerCase();

    setPoItemForms(
      basePoItemForms
        .map((item, index) => {
          const quote = quoteByTenderItemId.get(Number(item.tender_item_id));
          const allocatedQuantity = asPositiveAmount(
            quote?.loa_allocated_quantity || 0,
          );
          const allocatedAmount = asPositiveAmount(
            quote?.loa_allocated_amount || 0,
          );
          const extendedAmount = asPositiveAmount(
            extensionAmountByItem.get(Number(item.tender_item_id)) || 0,
          );
          const extendedQuantity = asPositiveAmount(
            extensionByItem.get(Number(item.tender_item_id)) || 0,
          );
          const usedQuantity = asPositiveAmount(
            existingUsageByTenderItem.get(Number(item.tender_item_id)) || 0,
          );
          const remainingQuantity = Math.max(
            allocatedQuantity + extendedQuantity - usedQuantity,
            0,
          );
          const isEligibleInQuantityMode =
            allocatedQuantity > 0 || extendedQuantity > 0;
          const isEligibleInAmountMode = allocatedAmount > 0 || extendedAmount > 0;
          const isEligible =
            allocationBasis === "quantity"
              ? isEligibleInQuantityMode
              : allocationBasis === "amount"
                ? isEligibleInAmountMode
                : true;

          return !isEligible
            ? null
            : {
                ...item,
                make: quote?.make || "",
                model: quote?.model || "",
                unit_rate: quote?.negotiated_amount
                  ? String(quote.negotiated_amount)
                  : item.unit_rate || "",
                quantity:
                  allocationBasis === "quantity"
                    ? remainingQuantity
                      ? normalizeNumericInputValue(remainingQuantity)
                      : ""
                    : item.quantity,
              };
        })
        .filter(Boolean),
    );
  }, [basePoItemForms, commercialForms, poForm.firm_id, purchaseOrders, vendors]);

  const selectedPoVendor = useMemo(
    () =>
      vendors.find((vendor) => Number(vendor.firm_id) === Number(poForm.firm_id)) ||
      null,
    [poForm.firm_id, vendors],
  );
  const selectedPoVendorAllocationBasis = String(
    selectedPoVendor?.loa_allocation_basis || "",
  ).toLowerCase();
  const selectedPoVendorPurchaseOrders = useMemo(
    () =>
      purchaseOrders.filter(
        (purchaseOrder) =>
          Number(purchaseOrder?.firm_id) === Number(selectedPoVendor?.firm_id),
      ),
    [purchaseOrders, selectedPoVendor?.firm_id],
  );
  const selectedPoVendorItemUsage = useMemo(
    () => sumPurchaseOrderItemQuantityByTenderItem(selectedPoVendorPurchaseOrders),
    [selectedPoVendorPurchaseOrders],
  );
  const selectedPoVendorAmountUsage = useMemo(
    () =>
      selectedPoVendorPurchaseOrders.reduce(
        (sum, purchaseOrder) => sum + Number(purchaseOrder?.po_value || 0),
        0,
      ),
    [selectedPoVendorPurchaseOrders],
  );
  const selectedPoVendorAllocationSummary = useMemo(() => {
    if (!selectedPoVendor) return null;
    const quantityExtensionByItem = new Map();
    const amountExtensionByItem = new Map();
    (selectedPoVendor.allocation_extensions || []).forEach((entry) => {
      (Array.isArray(entry?.items) ? entry.items : []).forEach((item) => {
        const tenderItemId = Number(item?.tender_item_id);
        if (!tenderItemId) return;
        quantityExtensionByItem.set(
          tenderItemId,
          Number(quantityExtensionByItem.get(tenderItemId) || 0) +
            Number(item?.extension_quantity || 0),
        );
        amountExtensionByItem.set(
          tenderItemId,
          Number(amountExtensionByItem.get(tenderItemId) || 0) +
            Number(item?.extension_amount || 0),
        );
      });
    });
    const quantityExtensionTotal = Array.from(quantityExtensionByItem.values()).reduce(
      (sum, value) => sum + Number(value || 0),
      0,
    );
    const amountExtensionTotal = Array.from(amountExtensionByItem.values()).reduce(
      (sum, value) => sum + Number(value || 0),
      0,
    );
    const itemRows = (selectedPoVendor.commercial_item_quotes || []).map((quote) => {
      const tenderItem = tenderItems.find(
        (item) => Number(item.id) === Number(quote.tender_item_id),
      );
      const baseAllocatedQuantity = Number(quote?.loa_allocated_quantity || 0);
      const extendedQuantity = Number(
        quantityExtensionByItem.get(Number(quote?.tender_item_id)) || 0,
      );
      const usedQuantity = Number(
        selectedPoVendorItemUsage.get(Number(quote?.tender_item_id)) || 0,
      );
      const baseAllocatedAmount = Number(quote?.loa_allocated_amount || 0);
      const extendedAmount = Number(
        amountExtensionByItem.get(Number(quote?.tender_item_id)) || 0,
      );
      return {
        tenderItemId: Number(quote?.tender_item_id),
        label: getTenderItemDisplayName(
          tenderItem,
          tenderItems.findIndex(
            (item) => Number(item.id) === Number(quote?.tender_item_id),
          ),
        ),
        itemName: tenderItem?.indent_item?.item_name || "NA",
        allocatedQuantity: baseAllocatedQuantity,
        extendedQuantity,
        usedQuantity,
        remainingQuantity: Math.max(
          baseAllocatedQuantity + extendedQuantity - usedQuantity,
          0,
        ),
        allocatedAmount: baseAllocatedAmount,
        extendedAmount,
      };
    });

    const baseAllocatedAmount = Number(
      selectedPoVendor?.loa_allocated_amount || 0,
    );

    return {
      basis: selectedPoVendorAllocationBasis,
      quantityExtensionTotal,
      amountExtensionTotal,
      baseAllocatedAmount,
      usedAmount: selectedPoVendorAmountUsage,
      remainingAmount: Math.max(
        baseAllocatedAmount + amountExtensionTotal - selectedPoVendorAmountUsage,
        0,
      ),
      itemRows,
    };
  }, [
    selectedPoVendor,
    selectedPoVendorAllocationBasis,
    selectedPoVendorAmountUsage,
    selectedPoVendorItemUsage,
    tenderItems,
  ]);

  useEffect(() => {
    if (selectedPoVendorAllocationBasis !== "quantity") return;
    const totalQuantity = poItemForms.reduce(
      (sum, item) => sum + (Number(item.quantity || 0) || 0),
      0,
    );
    setPoForm((current) => ({
      ...current,
      po_quantity: totalQuantity
        ? normalizeNumericInputValue(totalQuantity)
        : "",
    }));
  }, [poItemForms, selectedPoVendorAllocationBasis]);

  useEffect(() => {
    const totalValue = poItemForms.reduce(
      (sum, item) => sum + calculatePoItemTotalAmount(item),
      0,
    );
    const normalizedValue = totalValue
      ? normalizeNumericInputValue(totalValue)
      : "";
    setPoForm((current) =>
      current.po_value === normalizedValue
        ? current
        : {
            ...current,
            po_value: normalizedValue,
          },
    );
  }, [poItemForms]);

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
  const savedAllocationBasis = vendors.find(
    (vendor) => vendor?.loa_allocation_basis,
  )?.loa_allocation_basis;
  const savedAllocationScope = tender?.loa_allocation_scope || "";
  const isAllocationBasisFrozen = Boolean(savedAllocationBasis);
  const effectiveAllocationBasis = savedAllocationBasis || allocationBasis;
  const isAllocationScopeFrozen = Boolean(savedAllocationScope);
  const effectiveAllocationScope = savedAllocationScope || allocationScope;
  const finalTechnicalEvaluationMeeting = useMemo(
    () =>
      committees.find(
        (meeting) =>
          meeting?.purpose === "final_evaluation_technical" &&
          meeting?.proceedings_document_path,
      ) ||
      committees.find(
        (meeting) => meeting?.purpose === "final_evaluation_technical",
      ),
    [committees],
  );
  const financialEvaluationCommercialMeeting = useMemo(
    () =>
      committees.find(
        (meeting) =>
          meeting?.purpose === "financial_evaluation_commercial" &&
          meeting?.proceedings_document_path,
      ) ||
      committees.find(
        (meeting) => meeting?.purpose === "financial_evaluation_commercial",
      ),
    [committees],
  );
  const purchaseApprovalMinutesMeeting = useMemo(() => {
    const approvalMeetingTypes = new Set([
      "purchase_committee",
      "purchase_committee_lower",
      "purchase_committee_upper",
      "dhppc",
      "hppc",
    ]);
    return (
      committees.find(
        (meeting) =>
          approvalMeetingTypes.has(meeting?.meeting_type) &&
          meeting?.proceedings_document_path,
      ) ||
      committees.find((meeting) =>
        approvalMeetingTypes.has(meeting?.meeting_type),
      )
    );
  }, [committees]);

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
  const negotiationRankByVendorId = useMemo(() => {
    const priceEntries = commercialQualifiedVendors
      .map((vendor) => {
        const form = negotiationForms[vendor.id] || {};
        const itemwiseTotal = (commercialForms[vendor.id]?.commercial_item_quotes || []).reduce(
          (sum, quote) => sum + (asPositiveAmount(quote.negotiated_amount) || 0),
          0,
        );
        const price = asPositiveAmount(
          itemwiseTotal || form.negotiated_amount || vendor.negotiated_amount,
        );
        return price ? { vendorId: vendor.id, price } : null;
      })
      .filter(Boolean);
    const sortedUniquePrices = Array.from(
      new Set(priceEntries.map((entry) => entry.price)),
    ).sort((first, second) => first - second);

    return Object.fromEntries(
      priceEntries.map((entry) => [
        entry.vendorId,
        `L${sortedUniquePrices.indexOf(entry.price) + 1}`,
      ]),
    );
  }, [commercialForms, commercialQualifiedVendors, negotiationForms]);
  const negotiationItemRankByVendorId = useMemo(() => {
    const itemRankMap = {};

    tenderItems.forEach((item) => {
      const itemEntries = commercialQualifiedVendors
        .map((vendor) => {
          const quote = (commercialForms[vendor.id]?.commercial_item_quotes || []).find(
            (row) => Number(row.tender_item_id) === Number(item.id),
          );
          const price = asPositiveAmount(quote?.negotiated_amount);
          return price ? { vendorId: vendor.id, price } : null;
        })
        .filter(Boolean);

      const sortedUniquePrices = Array.from(
        new Set(itemEntries.map((entry) => entry.price)),
      ).sort((first, second) => first - second);

      itemEntries.forEach((entry) => {
        itemRankMap[entry.vendorId] = itemRankMap[entry.vendorId] || {};
        itemRankMap[entry.vendorId][item.id] = `L${
          sortedUniquePrices.indexOf(entry.price) + 1
        }`;
      });
    });

    return itemRankMap;
  }, [commercialForms, commercialQualifiedVendors, tenderItems]);
  const itemWiseL1ItemIdsByVendorId = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(negotiationItemRankByVendorId).map(
          ([vendorId, itemRanks]) => [
            Number(vendorId),
            Object.entries(itemRanks || {})
              .filter(([, rank]) => rank === "L1")
              .map(([itemId]) => Number(itemId)),
          ],
        ),
      ),
    [negotiationItemRankByVendorId],
  );
  const l1NegotiationVendors = useMemo(
    () =>
      commercialQualifiedVendors.filter(
        (vendor) => negotiationRankByVendorId[vendor.id] === "L1",
      ),
    [commercialQualifiedVendors, negotiationRankByVendorId],
  );
  const itemWiseL1NegotiationVendors = useMemo(
    () =>
      commercialQualifiedVendors.filter(
        (vendor) => (itemWiseL1ItemIdsByVendorId[vendor.id] || []).length > 0,
      ),
    [commercialQualifiedVendors, itemWiseL1ItemIdsByVendorId],
  );
  const allocationEligibleVendors = useMemo(
    () =>
      effectiveAllocationScope === "item_wise"
        ? itemWiseL1NegotiationVendors
        : l1NegotiationVendors,
    [
      effectiveAllocationScope,
      itemWiseL1NegotiationVendors,
      l1NegotiationVendors,
    ],
  );
  const negotiationComplete =
    postTechnicalComplete &&
    commercialQualifiedVendors.length > 0 &&
    commercialQualifiedVendors.every((vendor) => {
      const itemwiseTotal = (commercialForms[vendor.id]?.commercial_item_quotes || []).reduce(
        (sum, quote) => sum + (asPositiveAmount(quote.negotiated_amount) || 0),
        0,
      );
      return asPositiveAmount(itemwiseTotal || vendor.negotiated_amount);
    });
  const poCreated = purchaseOrders.length > 0;
  const pbgEngine = tender?.pbg_engine || {};
  const pbgVendorProfiles = Array.isArray(pbgEngine?.vendor_profiles)
    ? pbgEngine.vendor_profiles
    : [];
  const pbgObligations = Array.isArray(pbgEngine?.obligations)
    ? pbgEngine.obligations
    : [];
  const pbgReceipts = Array.isArray(pbgEngine?.receipts) ? pbgEngine.receipts : [];
  const pbgComplianceRows = Array.isArray(pbgEngine?.compliance)
    ? pbgEngine.compliance
    : [];
  const pbgReceiptSummariesByFirmId = useMemo(() => {
    const grouped = new Map();
    pbgReceipts.forEach((receipt) => {
      const firmId = Number(receipt?.firm_id);
      if (!firmId) return;
      const endDate = getPbgReceiptEndDate(receipt);
      const labelText = [
        receipt?.purchase_order?.po_no || "Contract-level",
        money(receipt?.pbg_amount),
        endDate || "NA",
      ].join(" • ");
      const currentRows = grouped.get(firmId) || [];
      currentRows.push({
        id: receipt.id,
        sortDate: endDate || receipt?.invocation_upto || receipt?.claim_period_upto || receipt?.valid_upto || "",
        label: labelText,
      });
      grouped.set(firmId, currentRows);
    });
    grouped.forEach((rows, firmId) => {
      rows.sort((left, right) => String(left.sortDate).localeCompare(String(right.sortDate)));
      grouped.set(
        firmId,
        rows.map((row) => ({ id: row.id, label: row.label })),
      );
    });
    return grouped;
  }, [pbgReceipts]);
  const selectedPbgReceiptVendorProfile = useMemo(
    () =>
      pbgVendorProfiles.find(
        (profile) => Number(profile.firm_id) === Number(pbgReceiptForm.firm_id || 0),
      ) || null,
    [pbgReceiptForm.firm_id, pbgVendorProfiles],
  );
  const selectedPbgReceiptVendorPurchaseOrders = useMemo(
    () =>
      purchaseOrders.filter(
        (po) => Number(po.firm_id) === Number(pbgReceiptForm.firm_id || 0),
      ),
    [purchaseOrders, pbgReceiptForm.firm_id],
  );

  const currentStepKey = useMemo(() => {
    if (!isTechnicalStepOpen) return "bid_window";
    if (!technicalEvaluationComplete) return "technical_evaluation";
	    if (!postTechnicalComplete) return "post_technical";
	    if (!negotiationComplete) return "negotiation_window";
	    if (!poCreated) return "purchase_orders";
	    return "pbg";
  }, [
    isTechnicalStepOpen,
    negotiationComplete,
    poCreated,
    postTechnicalComplete,
    technicalEvaluationComplete,
  ]);

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
          title: "Commercial Evaluation",
          description:
            "Record financial evaluation movement and commercial qualification results for technically qualified vendors.",
        },
        {
          key: "negotiation_window",
          title: "Negotiation Window",
          description:
            "Bring commercially qualified bidders into negotiation, record final negotiated prices, and identify L1 movement automatically.",
        },
        {
          key: "purchase_orders",
          title: "LOA/RC & PO",
          description:
            "After LOA/RC issue, add purchase order details and upload the PO copy for eligible firms.",
        },
        {
          key: "pbg",
          title: "PBG",
          description:
            "Track required, submitted, and short performance bank guarantee position against purchase orders.",
        },
	        {
	          key: "inspection_delivery",
	          title: "Inspection & Delivery",
	          description:
	            "Open PO-level fulfilment to record consignees, inspection, and delivery with item-wise quantity validation.",
	        },
	        {
	          key: "installation",
	          title: "Installation",
	          description:
	            "Record installation, site-not-ready, plug-and-play, or not-required cases against delivered PO quantities.",
	        },
	        {
	          key: "seller_invoice",
	          title: "Seller Invoice",
	          description:
	            "Record bill details received from the vendor and upload seller invoice copy against eligible delivered or installed quantity.",
	        },
	        {
	          key: "purchase_invoice",
	          title: "Purchase Book/Invoice",
	          description:
	            "Book the purchase in accounts with voucher details, TDS, round off, and purchase bill copy.",
	        },
        {
          key: "sale_invoice",
          title: "Sale Invoice",
          description:
            "Generate sale billing to the indenting organization with consultancy charges and account-generated bill copy.",
        },
        {
          key: "vendor_payment",
          title: "Firm/Vendor Payment",
          description:
            "Record payment release details, noting copy, reference, and payment history against each purchase order.",
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

        if (step.key === "negotiation_window") {
          status = !postTechnicalComplete
            ? "locked"
            : negotiationComplete
              ? "completed"
              : "current";
        }

        if (step.key === "purchase_orders") {
          status = !negotiationComplete
            ? "locked"
            : poCreated
              ? "completed"
              : "current";
        }

	        if (step.key === "pbg") {
	          status = !poCreated ? "locked" : "current";
	        }

	        if (step.key === "inspection_delivery") {
	          status = !poCreated ? "locked" : "available";
	        }

	        if (
	          [
	            "installation",
            "seller_invoice",
            "purchase_invoice",
            "sale_invoice",
            "vendor_payment",
          ].includes(step.key)
        ) {
	          status = !poCreated ? "locked" : "available";
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
      negotiationComplete,
      poCreated,
    ],
  );

  useEffect(() => {
    const selectedStep = steps.find((step) => step.key === selectedStepKey);
    if (!selectedStep || selectedStep.status === "locked") {
      setSelectedStepKey(currentStepKey);
    }
  }, [currentStepKey, selectedStepKey, steps]);

  useEffect(() => {
    const returnStep = location.state?.tenderStep;
    if (!returnStep) return;
    const targetStep = steps.find((step) => step.key === returnStep);
    if (targetStep && targetStep.status !== "locked") {
      setSelectedStepKey(returnStep);
    }
  }, [location.state, steps]);

  const updatePo = (field) => (event) => {
    setPoForm((current) => ({ ...current, [field]: event.target.value }));
    clearFieldError(setPoErrors, field);
  };

  const updatePoItem = (index, field, value) => {
    setPoItemForms((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
    clearFieldError(setPoErrors, "items");
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

  const setCommercialItemQuoteField = (vendorId, tenderItemId, field, value) => {
    setCommercialForms((current) => {
      const vendorForm = current[vendorId] || {};
      const nextItemQuotes = Array.isArray(vendorForm.commercial_item_quotes)
        ? vendorForm.commercial_item_quotes.map((quote) =>
            Number(quote.tender_item_id) === Number(tenderItemId)
              ? { ...quote, [field]: value }
              : quote,
          )
        : [];
      const totalQuotedAmount = nextItemQuotes.reduce(
        (sum, quote) => sum + (asPositiveAmount(quote.quoted_amount) || 0),
        0,
      );

      return {
        ...current,
        [vendorId]: {
          ...vendorForm,
          commercial_item_quotes: nextItemQuotes,
          final_quoted_amount: totalQuotedAmount ? String(totalQuotedAmount) : "",
        },
      };
    });
  };

  const toggleVendorItemEditor = (stageKey, vendorId) => {
    const editorKey = `${stageKey}:${vendorId}`;
    setOpenVendorItemEditors((current) => ({
      ...current,
      [editorKey]: !current[editorKey],
    }));
  };

  const setNegotiationField = (vendorId, field, value) => {
    setNegotiationForms((current) => ({
      ...current,
      [vendorId]: {
        ...(current[vendorId] || {}),
        [field]: value,
      },
    }));
  };

  const setAllocationExtensionField = (vendorId, field, value) => {
    setAllocationExtensionForms((current) => ({
      ...current,
      [vendorId]: {
        ...(current[vendorId] || {}),
        [field]: value,
      },
    }));
  };

  const setAllocationExtensionItemField = (
    vendorId,
    tenderItemId,
    field,
    value,
  ) => {
    setAllocationExtensionForms((current) => {
      const currentForm = current[vendorId] || {
        items: buildAllocationExtensionItems(tenderItems),
      };
      const items = Array.isArray(currentForm.items) ? currentForm.items : [];
      return {
        ...current,
        [vendorId]: {
          ...currentForm,
          items: items.map((item) =>
            Number(item.tender_item_id) === Number(tenderItemId)
              ? { ...item, [field]: value }
              : item,
          ),
        },
      };
    });
  };

  const setPbgSetupField = (vendorId, field, value) => {
    setPbgSetupForms((current) => ({
      ...current,
      [vendorId]: {
        ...(current[vendorId] || {}),
        [field]: value,
      },
    }));
  };

  const setTenderPbgSetupField = (field, value) => {
    setTenderPbgSetupForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updatePbgReceiptField = (field) => (event) => {
    const value = event.target.value;
    setPbgReceiptForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "firm_id" ? { po_id: "" } : {}),
    }));
  };

  const addLoaRcVendor = () => {
    if (!loaRcVendorPicker) return;
    setSelectedLoaRcVendorIds((current) =>
      current.includes(String(loaRcVendorPicker))
        ? current
        : [...current, String(loaRcVendorPicker)],
    );
    setLoaRcVendorPicker("");
  };

  const removeLoaRcVendor = (vendorId) => {
    setSelectedLoaRcVendorIds((current) =>
      current.filter((idValue) => idValue !== String(vendorId)),
    );
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
    const payload = {
      ...(technicalForms[vendorId] || {}),
      commercial_item_quotes:
        commercialForms[vendorId]?.commercial_item_quotes || [],
    };

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

  const saveVendorItemDetails = async (vendorId) => {
    setSavingVendorItemDetailsId(vendorId);
    try {
      const data = await patchProcurement(`/tenders/${id}/vendors/${vendorId}`, {
        commercial_item_quotes:
          commercialForms[vendorId]?.commercial_item_quotes || [],
      });
      setTender(data);
      hydrateVendorForms(data);
      setPopup({
        open: true,
        type: "success",
        message: "Bidder make and model details updated.",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to update bidder make and model details.",
      });
    } finally {
      setSavingVendorItemDetailsId(null);
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
      tenderItems.length > 1 &&
      payload.commercial_status === "qualified" &&
      (payload.commercial_item_quotes || []).some(
        (quote) => !asPositiveAmount(quote.quoted_amount),
      )
    ) {
      setPopup({
        open: true,
        type: "error",
        message:
          "Enter quoted price for each tender item before qualifying this vendor commercially.",
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

  const saveNegotiationReview = async (vendorId) => {
    const payload = negotiationForms[vendorId] || {};
    const itemwiseNegotiatedTotal = (
      commercialForms[vendorId]?.commercial_item_quotes || []
    ).reduce(
      (sum, quote) => sum + (asPositiveAmount(quote.negotiated_amount) || 0),
      0,
    );
    if (
      tenderItems.length > 1 &&
      (commercialForms[vendorId]?.commercial_item_quotes || []).some(
        (quote) => !asPositiveAmount(quote.negotiated_amount),
      )
    ) {
      setPopup({
        open: true,
        type: "error",
        message:
          "Enter negotiated price for each tender item before saving negotiation.",
      });
      return;
    }
    if (!asPositiveAmount(itemwiseNegotiatedTotal || payload.negotiated_amount)) {
      setPopup({
        open: true,
        type: "error",
        message: "Final negotiated price is required for negotiation ranking.",
      });
      return;
    }

    setSavingNegotiationVendorId(vendorId);
    try {
      const data = await patchProcurement(
        `/tenders/${id}/vendors/${vendorId}`,
        {
          negotiated_amount: itemwiseNegotiatedTotal || payload.negotiated_amount,
          is_l1: negotiationRankByVendorId[vendorId] === "L1",
          commercial_item_quotes:
            commercialForms[vendorId]?.commercial_item_quotes || [],
        },
      );
      setTender(data);
      hydrateVendorForms(data);
      setPopup({
        open: true,
        type: "success",
        message: "Negotiation price updated.",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to update negotiation price.",
      });
    } finally {
      setSavingNegotiationVendorId(null);
    }
  };

  const saveLoaAllocation = async (vendorId) => {
    const form = negotiationForms[vendorId] || {};
    const basis = effectiveAllocationBasis === "amount" ? "amount" : "quantity";
    const scope =
      effectiveAllocationScope === "item_wise" ? "item_wise" : "overall";
    const valueField =
      basis === "amount"
        ? "loa_allocated_amount"
        : "loa_allocated_quantity";
    const eligibleItemIds = new Set(
      scope === "item_wise" ? itemWiseL1ItemIdsByVendorId[vendorId] || [] : [],
    );
    const normalizedCommercialItemQuotes = (
      commercialForms[vendorId]?.commercial_item_quotes || []
    ).map((quote) => {
      if (
        scope === "item_wise" &&
        !eligibleItemIds.has(Number(quote.tender_item_id))
      ) {
        return {
          ...quote,
          loa_allocated_quantity: "",
          loa_allocated_amount: "",
        };
      }
      return quote;
    });
    const allocationRows =
      scope === "item_wise"
        ? normalizedCommercialItemQuotes.filter((quote) =>
            eligibleItemIds.has(Number(quote.tender_item_id)),
          )
        : normalizedCommercialItemQuotes;
    const itemwiseAllocationTotal = allocationRows.reduce(
      (sum, quote) =>
        sum +
        (asPositiveAmount(
          basis === "amount"
            ? quote.loa_allocated_amount
            : quote.loa_allocated_quantity,
        ) || 0),
      0,
    );
    if (
      tenderItems.length > 1 &&
      allocationRows.some(
        (quote) =>
          !asPositiveAmount(
            basis === "amount"
              ? quote.loa_allocated_amount
              : quote.loa_allocated_quantity,
          ),
      )
    ) {
      setPopup({
        open: true,
        type: "error",
        message:
          basis === "amount"
            ? "Enter allocated amount for each tender item before saving allocation."
            : "Enter allocated quantity for each tender item before saving allocation.",
      });
      return;
    }
    if (!asPositiveAmount(itemwiseAllocationTotal || form[valueField])) {
      setPopup({
        open: true,
        type: "error",
        message:
          basis === "amount"
            ? "Amount allocated is required."
            : "Quantity allocated is required.",
      });
      return;
    }

    setSavingLoaVendorId(vendorId);
    try {
      const data = await patchProcurement(
        `/tenders/${id}/vendors/${vendorId}`,
        {
          loa_allocation_basis: basis,
          loa_allocation_scope: scope,
          loa_allocated_quantity:
            basis === "quantity"
              ? itemwiseAllocationTotal || form.loa_allocated_quantity
              : "",
          loa_allocated_amount:
            basis === "amount"
              ? itemwiseAllocationTotal || form.loa_allocated_amount
              : "",
          commercial_item_quotes: normalizedCommercialItemQuotes,
          is_l1: true,
        },
      );
      setTender(data);
      hydrateVendorForms(data);
      setPopup({
        open: true,
        type: "success",
        message: "LOA/RC/PO allocation updated.",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to update allocation.",
      });
    } finally {
      setSavingLoaVendorId(null);
    }
  };

  const uploadLoaRcDocument = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "filename_base",
      `${loaRcIssueType || "loa_rc"}_${tender?.id || id}`,
    );
    return uploadProcurementFile("/files/upload/loa-rc-documents", formData);
  };

  const uploadPoDocument = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("filename_base", `po_${tender?.id || id}`);
    return uploadProcurementFile("/files/upload/purchase-orders", formData);
  };

  const uploadPbgDocument = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("filename_base", `pbg_${tender?.id || id}`);
    return uploadProcurementFile("/files/upload/pbg_document", formData);
  };

  const uploadAllocationExtensionDocument = async (vendorId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("filename_base", `allocation_extension_${id}_${vendorId}`);
    return uploadProcurementFile("/files/upload/allocation-extensions", formData);
  };

  const saveLoaRcIssue = async (vendorId) => {
    const form = negotiationForms[vendorId] || {};
    if (!["loa_issued", "rc_issued"].includes(loaRcIssueType)) {
      setPopup({
        open: true,
        type: "error",
        message: "Select LOA issued or RC issued before saving.",
      });
      return;
    }
    if (!form.loa_rc_issue_date) {
      setPopup({
        open: true,
        type: "error",
        message:
          loaRcIssueType === "rc_issued"
            ? "RC date is required."
            : "LOA date is required.",
      });
      return;
    }

    setSavingLoaRcVendorId(vendorId);
    try {
      const data = await patchProcurement(
        `/tenders/${id}/vendors/${vendorId}`,
        {
          loa_rc_issue_type: loaRcIssueType,
          loa_rc_issue_date: form.loa_rc_issue_date,
          loa_rc_document_path: form.loa_rc_document_path,
        },
      );
      setTender(data);
      hydrateVendorForms(data);
      setPopup({
        open: true,
        type: "success",
        message:
          loaRcIssueType === "rc_issued"
            ? "RC issue details updated."
            : "LOA issue details updated.",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to update LOA/RC issue details.",
      });
    } finally {
      setSavingLoaRcVendorId(null);
    }
  };

  const saveAllocationExtension = async (vendorId) => {
    const form = allocationExtensionForms[vendorId] || {};
    const basis = effectiveAllocationBasis === "amount" ? "amount" : "quantity";
    const items = (Array.isArray(form.items) ? form.items : []).filter((item) =>
      asPositiveAmount(
        basis === "amount" ? item.extension_amount : item.extension_quantity,
      ),
    );
    if (!items.length) {
      setPopup({
        open: true,
        type: "error",
        message:
          basis === "amount"
            ? "Enter item-wise extension amount for at least one item."
            : "Enter item-wise extension quantity for at least one item.",
      });
      return;
    }

    setSavingAllocationExtensionVendorId(vendorId);
    try {
      const data = await postProcurement(
        `/tenders/${id}/vendors/${vendorId}/allocation-extensions`,
        {
          extension_basis: basis,
          approval_reference: form.approval_reference,
          approval_date: form.approval_date,
          document_path: form.document_path,
          remarks: form.remarks,
          items,
        },
      );
      setTender(data);
      hydrateVendorForms(data);
      setPopup({
        open: true,
        type: "success",
        message: "Allocation extension recorded.",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to save allocation extension.",
      });
    } finally {
      setSavingAllocationExtensionVendorId(null);
    }
  };

  const savePbgSetup = async () => {
    const invalidVendorPercentage = Object.entries(pbgSetupForms).find(
      ([, form]) =>
        form?.pbg_percentage && !asPositiveAmount(form.pbg_percentage),
    );
    if (invalidVendorPercentage) {
      setPopup({
        open: true,
        type: "error",
        message: "Vendor PBG percentage must be greater than zero.",
      });
      return;
    }

    setSavingTenderPbgSetup(true);
    try {
      const data = await patchProcurement(`/tenders/${id}/pbg-setup`, {
        ...tenderPbgSetupForm,
        default_pbg_percentage: "",
        additional_claim_days: "0",
        warning_before_days: "30",
        vendor_setups: Object.entries(pbgSetupForms).map(
          ([vendorIdValue, form]) => ({
            vendor_id: vendorIdValue,
            pbg_percentage: form?.pbg_percentage || "",
          }),
        ),
      });
      setTender(data);
      hydrateVendorForms(data);
      setPopup({
        open: true,
        type: "success",
        message: "Tender PBG policy updated.",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to save PBG setup.",
      });
    } finally {
      setSavingTenderPbgSetup(false);
    }
  };

  const createPbgReceipt = async (event) => {
    event.preventDefault();
    if (!pbgReceiptForm.firm_id) {
      setPopup({
        open: true,
        type: "error",
        message: "Select vendor before saving PBG receipt.",
      });
      return;
    }
    if (!asPositiveAmount(pbgReceiptForm.pbg_amount)) {
      setPopup({
        open: true,
        type: "error",
        message: "PBG amount is required.",
      });
      return;
    }

    setSavingPbgReceipt(true);
    try {
      await postProcurement("/pbg", {
        tender_id: id,
        ...pbgReceiptForm,
        pbg_percentage: selectedPbgReceiptVendorProfile?.pbg_percentage
          ? String(selectedPbgReceiptVendorProfile.pbg_percentage)
          : undefined,
        po_id: pbgReceiptForm.po_id || null,
      });
      await loadTender();
      setPbgReceiptForm((current) => ({
        ...initialPbgReceiptForm,
        submission_mode: current.submission_mode,
        status: current.status,
        refund_status: current.refund_status,
      }));
      setPopup({
        open: true,
        type: "success",
        message: "PBG receipt recorded.",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to save PBG receipt.",
      });
    } finally {
      setSavingPbgReceipt(false);
    }
  };

  const createPo = async (event) => {
    event.preventDefault();
    const validationErrors = buildRequiredErrors(poForm, [
      { name: "firm_id", label: "Firm" },
      { name: "po_no", label: "PO No." },
      { name: "po_date", label: "PO Date" },
      { name: "po_value", label: "PO Value" },
      { name: "po_document_path", label: "PO Copy" },
    ]);
    if (
      !(tender?.tender_type === "rate_contract" && tender?.rate_contract_type === "value_based") &&
      !String(poForm.po_quantity || "").trim()
    ) {
      validationErrors.po_quantity = "PO quantity is required.";
    }
    if (!Number(poForm.warranty_years || 0) && !Number(poForm.warranty_months || 0)) {
      validationErrors.warranty_years = "Warranty period is required.";
    }
    const activePoItems = poItemForms.filter((item) => Number(item.quantity || 0) > 0);
    if (!activePoItems.length) {
      validationErrors.items = "At least one PO item with quantity is required.";
    }
    setPoErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    setSavingPo(true);
    try {
      await postProcurement("/purchase-orders", {
        ...poForm,
        items: activePoItems,
        warranty_period: buildWarrantyPeriod(poForm),
        warranty_start_date: poForm.warranty_start_date || "",
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
  const tenderReturnState = (stepKey = selectedStepKey) => ({
    returnTo: `/tenders/${id}`,
    returnLabel: "Back to tender workflow",
    tenderStep: stepKey,
  });
  const renderVendorItemEditor = (
    vendor,
    stageKey,
    { title = "Make / Model", readOnly = false } = {},
  ) => {
    const form = commercialForms[vendor.id] || {};
    const itemQuotes = Array.isArray(form.commercial_item_quotes)
      ? form.commercial_item_quotes
      : [];
    const editorKey = `${stageKey}:${vendor.id}`;
    const isOpen = Boolean(openVendorItemEditors[editorKey]);

    return (
      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="whitespace-nowrap"
          onClick={() => toggleVendorItemEditor(stageKey, vendor.id)}
        >
          {isOpen ? `Hide ${title}` : `${readOnly ? "View" : "Edit"} ${title}`}
        </Button>

        {isOpen ? (
          <div className="min-w-[34rem] space-y-2 rounded-[20px] border border-slate-200 bg-slate-50/80 p-3">
            {tenderItems.map((item, index) => {
              const quoteRow =
                itemQuotes.find(
                  (quote) =>
                    Number(quote.tender_item_id) === Number(item.id),
                ) || {};
              return (
                <div
                  key={item.id}
                  className="grid gap-2 rounded-[16px] border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1.4fr)_11rem_11rem]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {getTenderItemDisplayName(item, index)}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {item?.indent_item?.item_name || `Item ${index + 1}`}
                    </p>
                  </div>
                  <Input
                    value={quoteRow.make || ""}
                    onChange={(event) =>
                      setCommercialItemQuoteField(
                        vendor.id,
                        item.id,
                        "make",
                        event.target.value,
                      )
                    }
                    disabled={!canPerformOfficerTenderActions || readOnly}
                    placeholder="Make"
                  />
                  <Input
                    value={quoteRow.model || ""}
                    onChange={(event) =>
                      setCommercialItemQuoteField(
                        vendor.id,
                        item.id,
                        "model",
                        event.target.value,
                      )
                    }
                    disabled={!canPerformOfficerTenderActions || readOnly}
                    placeholder="Model"
                  />
                </div>
              );
            })}
            {canPerformOfficerTenderActions && !readOnly ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  className={primaryButtonClass}
                  disabled={savingVendorItemDetailsId === vendor.id}
                  onClick={() => saveVendorItemDetails(vendor.id)}
                >
                  {savingVendorItemDetailsId === vendor.id
                    ? "Saving..."
                    : "Save Make / Model"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };
  const renderVendorItemQuoteEditor = (
    vendor,
    {
      readOnly = false,
      stageKey = "quoted_price",
      field = "quoted_amount",
      title = "Item-wise Price Exclusive of GST",
      totalLabel = "Total price exclusive of GST",
      buttonLabel = "Edit Item-wise Price Exclusive of GST",
      hideButtonLabel = "Hide Item-wise Price Exclusive of GST",
      placeholder = "Price exclusive of GST",
      saveLabel = "",
      onSave = null,
      saving = false,
      visibleItemIds = null,
    } = {},
  ) => {
    const form = commercialForms[vendor.id] || {};
    const itemQuotes = Array.isArray(form.commercial_item_quotes)
      ? form.commercial_item_quotes
      : [];
    const isQuantityField = field === "loa_allocated_quantity";
    const visibleItemIdSet = visibleItemIds ? new Set(visibleItemIds) : null;
    const scopedItemQuotes = visibleItemIdSet
      ? itemQuotes.filter((quote) =>
          visibleItemIdSet.has(Number(quote.tender_item_id)),
        )
      : itemQuotes;
    const scopedTenderItems = visibleItemIdSet
      ? tenderItems.filter((item) => visibleItemIdSet.has(Number(item.id)))
      : tenderItems;
    const editorKey = `${stageKey}:${vendor.id}`;
    const isOpen = Boolean(openVendorItemEditors[editorKey]);
    const totalQuotedAmount = scopedItemQuotes.reduce(
      (sum, quote) => sum + (asPositiveAmount(quote[field]) || 0),
      0,
    );
    const formatSummaryValue = (value) =>
      isQuantityField ? formatPlainNumber(value) : money(value);

    if (scopedTenderItems.length <= 1) {
      const singleItemQuote = scopedItemQuotes[0] || {};
      const singleTenderItem = scopedTenderItems[0] || null;
      const singleTenderItemIndex = singleTenderItem
        ? tenderItems.findIndex(
            (item) => Number(item.id) === Number(singleTenderItem.id),
          )
        : -1;
      const singleFieldValue =
        field === "quoted_amount"
          ? form.final_quoted_amount || singleItemQuote[field] || ""
          : field === "negotiated_amount"
            ? form.negotiated_amount || singleItemQuote[field] || ""
            : singleItemQuote[field] || "";
      const displayFieldValue = isQuantityField
        ? normalizeNumericInputValue(singleFieldValue)
        : singleFieldValue;
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="whitespace-nowrap"
              onClick={() => toggleVendorItemEditor(stageKey, vendor.id)}
            >
              {isOpen ? `Hide ${title}` : buttonLabel}
            </Button>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              {displayFieldValue
                ? `Total ${formatSummaryValue(displayFieldValue)}`
                : `${title} not entered`}
            </div>
          </div>
          {isOpen ? (
            <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-3">
              {singleTenderItem ? (
                <div className="mb-3 rounded-[16px] border border-slate-200 bg-white px-3 py-2">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {getTenderItemDisplayName(
                      singleTenderItem,
                      singleTenderItemIndex >= 0 ? singleTenderItemIndex : 0,
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {singleTenderItem?.indent_item?.item_name ||
                      `Item ${
                        singleTenderItemIndex >= 0
                          ? singleTenderItemIndex + 1
                          : 1
                      }`}
                  </p>
                </div>
              ) : null}
              <Input
                type="number"
                min="0"
                value={displayFieldValue}
                onChange={(event) =>
                  field === "negotiated_amount"
                    ? setNegotiationField(
                        vendor.id,
                        "negotiated_amount",
                        event.target.value,
                      )
                    : field === "quoted_amount"
                      ? setCommercialField(
                          vendor.id,
                          "final_quoted_amount",
                          event.target.value,
                        )
                      : setCommercialItemQuoteField(
                          vendor.id,
                          scopedTenderItems[0]?.id,
                          field,
                          event.target.value,
                        )
                }
                disabled={!canPerformOfficerTenderActions || readOnly}
              />
              {canPerformOfficerTenderActions && onSave && !readOnly ? (
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    className={primaryButtonClass}
                    disabled={saving}
                    onClick={() => onSave(vendor.id)}
                  >
                    {saving ? "Saving..." : saveLabel || "Save"}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="whitespace-nowrap"
            onClick={() => toggleVendorItemEditor(stageKey, vendor.id)}
          >
            {isOpen ? hideButtonLabel : buttonLabel}
          </Button>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            {totalQuotedAmount
              ? `Total ${formatSummaryValue(totalQuotedAmount)}`
              : `${title} not entered`}
          </div>
        </div>
        {isOpen ? (
          <div className="min-w-[24rem] space-y-2 rounded-[20px] border border-slate-200 bg-slate-50/80 p-3">
            {scopedTenderItems.map((item, index) => {
              const quoteRow =
                itemQuotes.find(
                  (quote) => Number(quote.tender_item_id) === Number(item.id),
                ) || {};
              return (
                <div
                  key={`${stageKey}-${item.id}`}
                  className="grid gap-2 rounded-[16px] border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_10rem]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {getTenderItemDisplayName(item, index)}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {item?.indent_item?.item_name || `Item ${index + 1}`}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    value={
                      isQuantityField
                        ? normalizeNumericInputValue(quoteRow[field] || "")
                        : quoteRow[field] || ""
                    }
                    onChange={(event) =>
                      setCommercialItemQuoteField(
                        vendor.id,
                        item.id,
                        field,
                        event.target.value,
                      )
                    }
                    disabled={!canPerformOfficerTenderActions || readOnly}
                    placeholder={placeholder}
                  />
                </div>
              );
            })}
            <div className="flex items-center justify-between rounded-[16px] border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
              <span>{totalLabel}</span>
              <span className="text-sm font-semibold text-slate-900">
                {totalQuotedAmount
                  ? formatSummaryValue(totalQuotedAmount)
                  : "Not entered"}
              </span>
            </div>
            {canPerformOfficerTenderActions && onSave && !readOnly ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  className={primaryButtonClass}
                  disabled={saving}
                  onClick={() => onSave(vendor.id)}
                >
                  {saving ? "Saving..." : saveLabel || "Save"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };
  const isLoaRcIssued = ["loa_issued", "rc_issued"].includes(loaRcIssueType);
  const loaRcDateLabel =
    loaRcIssueType === "rc_issued" ? "RC Date" : "LOA Date";
  const loaRcUploadLabel =
    loaRcIssueType === "rc_issued" ? "Copy of RC" : "Copy of LOA";
  const loaRcSelectableVendors = allocationEligibleVendors;
	  const loaRcIssueVendors = loaRcSelectableVendors.filter((vendor) =>
	    selectedLoaRcVendorIds.includes(String(vendor.id)),
	  );
  const renderPoWorkspaceStep = ({
    eyebrow,
    title,
	    description,
	    actionLabel,
	    emptyMessage,
	    routePath = "",
	  }) => (
	    <div className="space-y-6">
	      <div className={mutedPanelClass}>
	        <p className={sectionMiniHeadingClass}>{eyebrow}</p>
	        <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#1d1d1f]">
	          {title}
	        </h3>
	        <p className="mt-1 max-w-3xl text-sm leading-6 text-black/56">
	          {description}
	        </p>
	      </div>

      {purchaseOrders.length ? (
        <div className="space-y-3">
          {purchaseOrders.map((po) => (
            <button
              key={po.id}
              type="button"
              onClick={() =>
                navigate(`/tenders/${id}/${routePath}/${po.id}`, {
                  state: tenderReturnState(selectedStepKey),
                })
              }
              className="group w-full overflow-hidden rounded-[24px] bg-white text-left shadow-[0_18px_42px_-36px_rgba(0,0,0,0.5)] ring-1 ring-black/8 transition hover:-translate-y-0.5 hover:shadow-[0_26px_58px_-38px_rgba(0,113,227,0.45)] hover:ring-[#0071e3]/25"
            >
              <div className="grid gap-px bg-black/6 lg:grid-cols-[1.2fr_1.6fr_auto]">
                <div className="bg-white px-4 py-3.5 md:px-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/38">
                    Purchase Order
                  </p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h4 className="text-[1.45rem] font-semibold tracking-[-0.045em] text-[#1d1d1f]">
                      {po.po_no}
                    </h4>
                    <p className="text-sm font-medium text-black/52">
                      {po?.firm?.firm_name || "Firm not available"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-px bg-black/6 sm:grid-cols-3">
                  {[
                    ["Value", money(po.po_value)],
                    ["Qty", po.po_quantity || "NA"],
                    ["Warranty Start", po.warranty_start_date || "Pending"],
                  ].map(([labelText, value]) => (
                    <div key={labelText} className="bg-[#f8f8fa] px-4 py-3">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-black/36">
                        {labelText}
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-[#1d1d1f]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 bg-white px-4 py-3.5 lg:min-w-[13rem] lg:justify-end">
                  <span className="text-xs font-medium text-black/42 lg:hidden">
                    Continue selected PO
                  </span>
                  <span className="rounded-full bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-18px_rgba(0,113,227,0.85)] transition group-hover:bg-[#0066cc]">
                    {actionLabel}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
	      ) : (
	        <div className={dashedPanelClass}>{emptyMessage}</div>
      )}
    </div>
  );

  const renderCommitteeMeetingPanel = ({ title, description }) => (
    <details className="group space-y-4 rounded-[24px] bg-white p-3 ring-1 ring-black/8">
      <summary
        className={`flex cursor-pointer list-none flex-col gap-3 [&::-webkit-details-marker]:hidden md:flex-row md:items-center md:justify-between ${mutedPanelClass}`}
      >
        <div className="flex items-start gap-3">
          <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/8 bg-white text-black/54 transition-colors group-open:bg-[#0071e3]/8 group-open:text-[#0071e3]">
            <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" />
          </span>
          <div>
          <h3 className="text-lg font-semibold text-[#1d1d1f]">{title}</h3>
          <p className="text-sm text-black/56">
            Click to view/add committee meetings. Meetings recorded for this tender: {committees.length}
          </p>
          {description ? (
            <p className="mt-1 text-xs text-black/45">{description}</p>
          ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2" onClick={(event) => event.preventDefault()}>
          <Button
            type="button"
            variant="outline"
            className={lightButtonClass}
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
              className={primaryButtonClass}
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
      </summary>

      <div className={`${tableShellClass} mt-4`}>
        <table className="min-w-full text-left text-sm">
          <thead className={tableHeadClass}>
            <tr>
              <th className="px-4 py-3">Meeting No.</th>
              <th className="px-4 py-3">Meeting Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Purpose</th>
              <th className="px-4 py-3">Agenda</th>
              <th className="px-4 py-3">Minutes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {committees.length ? (
              committees.map((meeting) => (
                <tr key={meeting.id} className="bg-white">
                  <td className="px-4 py-3 font-medium">
                    {meeting.meeting_no || "NA"}
                  </td>
                  <td className="px-4 py-3">{meeting.meeting_date || "NA"}</td>
                  <td className="px-4 py-3">{label(meeting.meeting_type)}</td>
                  <td className="px-4 py-3">{label(meeting.purpose)}</td>
                  <td className="px-4 py-3">
                    {meeting.agenda_document_path ? (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={toProcurementFileViewUrl(
                            meeting.agenda_document_path,
                          )}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Eye className="h-4 w-4" />
                          View Agenda
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Not uploaded
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {meeting.proceedings_document_path ? (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={toProcurementFileViewUrl(
                            meeting.proceedings_document_path,
                          )}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Eye className="h-4 w-4" />
                          View Minutes
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Not uploaded
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                  No committee meeting has been added for this tender yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </details>
  );

  return (
    <div className="min-h-full bg-[#f5f5f7] px-4 py-5 text-[#1d1d1f]">
      <div className="mx-auto max-w-[1580px] space-y-4">
        <section className="overflow-hidden rounded-[30px] bg-black text-white shadow-[0_24px_60px_-42px_rgba(0,0,0,0.72)]">
          <div className="border-b border-white/10 px-6 py-3.5 md:px-7">
            <Link
              to="/tenders"
              className="inline-flex items-center gap-2 text-sm font-medium text-white/68 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to tenders
            </Link>
          </div>

          <div className="px-6 py-5 md:px-7">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/42">
                Tender Workflow
              </p>
              <h1 className="mt-2 max-w-5xl text-[2.15rem] font-semibold tracking-[-0.04em] text-white md:text-[3.2rem] md:leading-[1.03]">
                {tender?.tender_title}
              </h1>
              <p className="mt-2 max-w-4xl text-[15px] text-white/66 md:text-[17px]">
                {tenderReference(tender)} • {label(tender?.portal_type)} •{" "}
                {tender?.location_scope}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/74">
                {tender?.status ? (
                  <span>
                    <span className="text-white/38">Status</span>{" "}
                    <span className="font-medium text-white">
                      {label(tender.status)}
                    </span>
                  </span>
                ) : null}
                {tender?.file_no ? (
                  <span>
                    <span className="text-white/38">File No.</span>{" "}
                    <span className="font-medium text-white">
                      {tender.file_no}
                    </span>
                  </span>
                ) : null}
                  {tender?.procurement_case?.case_no ? (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/procurement-cases/${tender.procurement_case.id}`,
                        )
                      }
                    className="text-sm text-white/72 transition hover:text-[#2997ff]"
                    >
                    <span className="text-white/38">Procurement Case</span>{" "}
                      <span className="font-medium text-white">
                        {tender.procurement_case.case_no}
                      </span>
                    </button>
                  ) : null}
                  {tender?.procurement_case?.indent?.system_indent_no ||
                  tender?.procurement_case?.indent?.indent_no ? (
                    <p className="text-sm text-white/72">
                      <span className="text-white/38">Indent</span>{" "}
                      <span className="font-medium text-white">
                        {tender.procurement_case.indent.system_indent_no ||
                          tender.procurement_case.indent.indent_no}
                      </span>
                    </p>
                  ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-black/8 pb-3 pt-1">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Total Vendors", stats.totalVendors],
              ["EMD Records", stats.emdRecords],
              ["Technical Pending", technicalPendingVendors.length],
              ["Commercial Pending", commercialPendingVendors.length],
              ["POs", purchaseOrders.length],
            ].map(([title, value]) => (
              <div
                key={title}
                className="rounded-[20px] bg-white px-4 py-3 shadow-[0_12px_30px_-24px_rgba(0,0,0,0.35)] ring-1 ring-black/6"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-black/34">
                  {title}
                </span>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <span className="text-[2.2rem] leading-none font-semibold tracking-[-0.07em] text-[#1d1d1f]">
                    {value}
                  </span>
                  {/* <span className="pb-1 text-[11px] font-medium text-black/28">
                    live
                  </span> */}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] bg-white">
          <div className="border-b border-black/6 px-6 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/42">
                  Tender Steps
                </p>
                <h2 className="mt-1.5 text-[1.65rem] font-semibold tracking-[-0.04em] text-[#1d1d1f] md:text-[2rem]">
                  {selectedStep?.title}
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-black/58">
                  {selectedStep?.description}
                </p>
              </div>
              <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:text-right">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/38">
                    Original Last Date
                  </p>
                  <p className="mt-1 font-medium text-[#1d1d1f]">
                    {formatDeadline(tender?.bid_submission_date)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/38">
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
            <div className="overflow-x-auto">
              <div className="inline-flex min-w-full gap-2 rounded-[22px] bg-[#f5f5f7] p-1.5">
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
                    className={`min-w-[15rem] flex-1 rounded-[18px] px-4 py-3 text-left transition ${
                      selectedStepKey === step.key
                        ? "bg-white text-[#1d1d1f] shadow-[0_10px_24px_-18px_rgba(0,0,0,0.45)]"
                        : step.status === "completed"
                          ? "bg-transparent text-[#1d1d1f]"
                          : step.status === "available"
                            ? "bg-transparent text-[#1d1d1f]"
                            : step.status === "locked"
                              ? "cursor-not-allowed bg-transparent text-black/34"
                              : "bg-transparent text-[#1d1d1f] hover:bg-white/70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/38">
                          Step {index + 1}
                        </p>
                        <p className="mt-1 text-[13px] font-semibold tracking-[-0.01em] md:text-sm">
                          {step.title}
                        </p>
                      </div>
                      <div
                        className={
                          selectedStepKey === step.key ? "text-[#0071e3]" : ""
                        }
                      >
                        {iconForStep(step.status)}
                      </div>
                    </div>
                    <p
                      className={`mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                        selectedStepKey === step.key
                          ? "text-[#0071e3]"
                          : "text-black/42"
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
          </div>

          <div className="p-4 md:p-5">

            {selectedStepKey === "bid_window" ? (
              <div className="space-y-4">
                {tender?.document_path ? (
                  <div className={`flex flex-col gap-3 md:flex-row md:items-center md:justify-between ${mutedPanelClass}`}>
                    <div>
                      <p className="text-lg font-semibold text-[#1d1d1f]">
                        Tender Document
                      </p>
                      <p className="text-sm text-black/56">
                        Tender file is available here while the bid window
                        remains open.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" className={lightButtonClass}>
                        <a
                          href={toProcurementFileViewUrl(tender.document_path)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Eye className="h-4 w-4" />
                          View Document
                        </a>
                      </Button>
                      <Button asChild variant="outline" className={lightButtonClass}>
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

                {renderCommitteeMeetingPanel({
                  title: "Bid-Window Committee Meetings",
                  description:
                    "Record any indent examination, pre-opening, specification, or tender-condition committee movement during the bid window.",
                })}

                {canRecordSubmissionExtension ? (
                  <form
                    className="grid gap-3 rounded-[24px] border border-black/8 bg-white p-4 lg:grid-cols-4"
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
                      className={primaryButtonClass}
                      disabled={savingExtension}
                    >
                      {savingExtension ? "Saving..." : "Add Extension"}
                    </Button>
                  </form>
                ) : (
                  <div className={dashedPanelClass}>
                    {hasBidOpened
                      ? "Submission extension can no longer be recorded because bid opening work has already started by adding vendors."
                      : "Submission extension can be recorded only by authorized procurement roles."}
                  </div>
                )}

                <div className={tableShellClass}>
                  <table className="min-w-full text-left text-sm">
                    <thead className={tableHeadClass}>
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
                    <div className={`flex-1 ${dashedPanelClass}`}>
                      Vendor participation can be reviewed here. Creation
                      changes are limited to authorized roles.
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-5">
                  {[
                    ["Total Bidders Participated", vendors.length, false, null],
                    ["Bidders Technically Qualified", technicalQualifiedVendors.length, false, null],
                    ["Required EMD", stats.requiredAmount, false],
                    ["Submitted EMD", stats.submittedAmount, false],
                    ["Short EMD", stats.shortAmount, Number(stats.shortAmount || 0) > 0],
                  ].map(([title, value, danger, fullValue]) => (
                    <div
                      key={title}
                      className={`rounded-[24px] border px-5 py-4 ${
                        danger
                          ? "border-rose-200 bg-rose-50"
                          : "border-black/8 bg-white"
                      }`}
                    >
                      <p className={sectionMiniHeadingClass}>{title}</p>
                      <p
                        className={`mt-2 text-2xl font-semibold tracking-[-0.03em] ${
                          danger ? "text-rose-700" : "text-[#1d1d1f]"
                        }`}
                        title={fullValue || (typeof value === "number" && title.includes("EMD") ? money(value) : undefined)}
                      >
                        {title.includes("EMD") ? compactMoney(value) : value}
                      </p>
                    </div>
                  ))}
                </div>

                {renderCommitteeMeetingPanel({
                  title: "Technical-Stage Committee Meetings",
                  description:
                    "If clarification, scrutiny, or any technical concern needs a meeting, record it here during the technical evaluation phase.",
                })}

                <div className={tableShellClass}>
                  <table className="min-w-max text-left text-sm">
                    <thead className={tableHeadClass}>
                      <tr>
                        <th className={`${stickyFirstHeadClass} whitespace-nowrap px-4 py-3`}>
                          S.No.
                        </th>
                        <th
                          className={`${stickySecondHeadClass} whitespace-nowrap px-4 py-3`}
                        >
                          Firm
                        </th>
                        <th className="whitespace-nowrap px-4 py-3">EMD</th>
                        <th className="whitespace-nowrap px-4 py-3">Submission Date</th>
                        <th className="whitespace-nowrap px-4 py-3">Submission Mode</th>
	                        <th className="whitespace-nowrap px-4 py-3">BG Valid Upto</th>
	                        <th className="whitespace-nowrap px-4 py-3">BG Claim Upto</th>
	                        <th className="whitespace-nowrap px-4 py-3">Technical Status</th>
	                        <th className="whitespace-nowrap px-4 py-3">Make / Model</th>
	                        <th className="whitespace-nowrap px-4 py-3">
	                          Final Evaluation Minutes
	                        </th>
                        <th className="whitespace-nowrap px-4 py-3">Action</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vendors.map((vendor, index) => {
                        const form = technicalForms[vendor.id] || {};
                        return (
                          <tr key={vendor.id} className="bg-white align-top">
                            <td className={`${stickyFirstCellClass} whitespace-nowrap px-4 py-3`}>
                              {index + 1}
                            </td>
                            <td
                              className={`${stickySecondCellClass} whitespace-nowrap px-4 py-3 font-medium text-[#1d1d1f]`}
                            >
                              {vendor?.firm?.firm_name || "NA"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <div className="whitespace-nowrap font-medium text-[#1d1d1f]">
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
                                  className="mt-2 whitespace-nowrap"
                                  onClick={() =>
                                    navigate(`/emd/${vendor.emd_entry.id}/edit`, {
                                      state: tenderReturnState(
                                        "technical_evaluation",
                                      ),
                                    })
                                  }
                                >
                                  Update EMD
                                </Button>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              {vendor?.emd_entry?.deposit_date || "NA"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              {label(vendor?.emd_entry?.submission_mode)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              {/bg|guarantee/.test(
                                String(
                                  vendor?.emd_entry?.submission_mode || "",
                                ).toLowerCase(),
                              )
                                ? vendor?.emd_entry?.bg_valid_upto || "NA"
                                : "NA"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              {/bg|guarantee/.test(
                                String(
                                  vendor?.emd_entry?.submission_mode || "",
                                ).toLowerCase(),
                              )
                                ? vendor?.emd_entry?.bg_claim_period_upto ||
                                  "NA"
                                : "NA"}
                            </td>
	                            <td className="whitespace-nowrap px-4 py-3">
	                              <select
                                className={compactSelectClass}
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
	                              {renderVendorItemEditor(
	                                vendor,
	                                "technical_evaluation",
	                              )}
	                            </td>
	                            <td className="whitespace-nowrap px-4 py-3">
	                              {finalTechnicalEvaluationMeeting?.proceedings_document_path ? (
                                <Button asChild variant="outline" size="sm">
                                  <a
                                    href={toProcurementFileViewUrl(
                                      finalTechnicalEvaluationMeeting.proceedings_document_path,
                                    )}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <Eye className="h-4 w-4" />
                                    View
                                  </a>
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled
                                >
                                  Not Uploaded
                                </Button>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              {canPerformOfficerTenderActions ? (
                                <Button
                                  className={primaryButtonClass}
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
                            <td className="whitespace-nowrap px-4 py-3 text-right">
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
	                            colSpan={12}
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
                <div className="rounded-[24px] border border-[#0071e3]/18 bg-[#f7fbff] px-4 py-3 text-sm text-[#1d1d1f]">
                  Record commercial evaluation against technically qualified
                  vendors. Financial Evaluation (Commercial) minutes can be
                  viewed from each vendor row once uploaded in the linked
                  committee meeting.
                </div>

                {renderCommitteeMeetingPanel({
                  title: "Commercial Evaluation Committee Meetings",
                  description:
                    "Record financial evaluation, commercial scrutiny, or related committee movement during commercial evaluation.",
                })}

                <div className={tableShellClass}>
                  <table className="min-w-max text-left text-sm">
	                    <thead className={tableHeadClass}>
	                      <tr>
	                        <th className={`${stickyFirstHeadClass} whitespace-nowrap px-4 py-3`}>
	                          S.No.
	                        </th>
	                        <th
	                          className={`${stickySecondHeadClass} whitespace-nowrap px-4 py-3`}
	                        >
	                          Firm
	                        </th>
	                        <th className="px-4 py-3">Commercial Status</th>
	                        <th className="px-4 py-3">Make / Model</th>
	                        <th className="px-4 py-3">
	                          {tenderItems.length > 1
	                            ? "Item-wise Quoted Price Exclusive of GST"
	                            : "Quoted Price Exclusive of GST"}
	                        </th>
	                        <th className="px-4 py-3">
	                          Financial Evaluation Minutes
	                        </th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
		                      {technicalQualifiedVendors.map((vendor, index) => {
		                        const form = commercialForms[vendor.id] || {};
	                        return (
	                          <tr key={vendor.id} className="bg-white align-top">
                            <td className={`${stickyFirstCellClass} whitespace-nowrap px-4 py-3`}>
                              {index + 1}
                            </td>
                            <td
                              className={`${stickySecondCellClass} whitespace-nowrap px-4 py-3 font-medium`}
                            >
                              {vendor?.firm?.firm_name || "NA"}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                className={compactSelectClass}
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
		                              {renderVendorItemEditor(
		                                vendor,
		                                "post_technical_make_model",
		                                { readOnly: true },
		                              )}
		                            </td>
		                            <td className="px-4 py-3">
		                              {renderVendorItemQuoteEditor(vendor, {
		                                stageKey: "post_technical_quote",
		                              })}
		                            </td>
                            <td className="px-4 py-3">
                              {financialEvaluationCommercialMeeting?.proceedings_document_path ? (
                                <Button asChild variant="outline" size="sm">
                                  <a
                                    href={toProcurementFileViewUrl(
                                      financialEvaluationCommercialMeeting.proceedings_document_path,
                                    )}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <Eye className="h-4 w-4" />
                                    View
                                  </a>
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled
                                >
                                  Not Uploaded
                                </Button>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {canPerformOfficerTenderActions ? (
                                <Button
                                  className={primaryButtonClass}
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

            {selectedStepKey === "negotiation_window" ? (
              <div className="space-y-6">
                {!commercialQualifiedVendors.length ? (
                  <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                    No commercially qualified bidder is available for the
                    negotiation window.
                  </div>
                ) : null}

                <div className={mutedPanelClass}>
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className={sectionMiniHeadingClass}>
                        Negotiation Window
                      </p>
                      <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                        Commercially qualified bidders called for negotiation
                      </h3>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-black/56">
                        Quoted price exclusive of GST is carried from
                        commercial evaluation. Enter the final negotiated
                        price exclusive of GST; L1, L2, L3 ranking is
                        calculated automatically, with equal lowest prices
                        shown as L1.
                      </p>
                    </div>
                    <div className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#1d1d1f]">
                      L1 bidders: {l1NegotiationVendors.length || 0}
                    </div>
                  </div>
                </div>

                {renderCommitteeMeetingPanel({
                  title: "Negotiation Committee Meetings",
                  description:
                    "Record purchase committee, DHPPC, HPPC, or negotiation approval meetings before final allocation and LOA/RC/PO movement.",
                })}

                <div className={tableShellClass}>
                  <table className="min-w-max text-left text-sm">
                    <thead className={tableHeadClass}>
	                      <tr>
	                        <th className={`${stickyFirstHeadClass} whitespace-nowrap px-4 py-3`}>S.No.</th>
	                        <th className={`${stickySecondHeadClass} whitespace-nowrap px-4 py-3`}>Firm</th>
	                        <th className="whitespace-nowrap px-4 py-3">Make / Model</th>
	                        <th className="whitespace-nowrap px-4 py-3">
	                          Quoted Price Exclusive of GST
	                        </th>
                        <th className="whitespace-nowrap px-4 py-3">
                          Final Negotiated Price Exclusive of GST
                        </th>
                        <th className="whitespace-nowrap px-4 py-3">
                          L1 Status
                        </th>
                        <th className="whitespace-nowrap px-4 py-3">
                          Purchase Minutes
                        </th>
                        <th className="whitespace-nowrap px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
	                      {commercialQualifiedVendors.map((vendor, index) => {
	                        const form = negotiationForms[vendor.id] || {};
	                        const rank = negotiationRankByVendorId[vendor.id];
	                        const itemwiseRanks =
	                          negotiationItemRankByVendorId[vendor.id] || {};
	                        return (
                          <tr key={vendor.id} className="bg-white align-top">
                            <td className={`${stickyFirstCellClass} whitespace-nowrap px-4 py-3`}>
                              {index + 1}
                            </td>
	                            <td className={`${stickySecondCellClass} whitespace-nowrap px-4 py-3 font-medium`}>
	                              {vendor?.firm?.firm_name || "NA"}
	                            </td>
		                            <td className="px-4 py-3">
		                              {renderVendorItemEditor(
		                                vendor,
		                                "negotiation_window_make_model",
		                                { readOnly: true },
		                              )}
		                            </td>
		                            <td className="whitespace-nowrap px-4 py-3">
		                              {renderVendorItemQuoteEditor(vendor, {
		                                readOnly: true,
		                                stageKey: "negotiation_window_quote",
		                              })}
		                            </td>
	                            <td className="whitespace-nowrap px-4 py-3">
		                              {renderVendorItemQuoteEditor(vendor, {
		                                stageKey: "negotiation_window_negotiated",
		                                field: "negotiated_amount",
		                                title:
		                                  "Negotiated Price Exclusive of GST",
		                                totalLabel:
		                                  "Total negotiated price exclusive of GST",
		                                buttonLabel:
		                                  "Edit Item-wise Negotiated Price Exclusive of GST",
		                                hideButtonLabel:
		                                  "Hide Item-wise Negotiated Price Exclusive of GST",
		                                placeholder: "Price exclusive of GST",
		                                saveLabel: "Save Negotiation",
		                                onSave: saveNegotiationReview,
		                                saving:
		                                  savingNegotiationVendorId === vendor.id,
		                              })}
		                            </td>
	                            <td className="whitespace-nowrap px-4 py-3">
	                              <div className="min-w-[15rem] space-y-2">
	                                <div>
	                                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
	                                    Overall
	                                  </p>
	                                  <span
	                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
	                                      rank === "L1"
	                                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
	                                        : rank
	                                          ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
	                                          : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
	                                    }`}
	                                  >
	                                    {rank || "Pending"}
	                                  </span>
	                                </div>
	                                {tenderItems.length > 1 ? (
	                                  <div className="space-y-1 rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-2">
	                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
	                                      Item-wise
	                                    </p>
	                                    {tenderItems.map((item, itemIndex) => {
	                                      const itemRank = itemwiseRanks[item.id];
	                                      return (
	                                        <div
	                                          key={`${vendor.id}-${item.id}-rank`}
	                                          className="flex items-center justify-between gap-3 text-xs"
	                                        >
	                                          <span className="truncate text-slate-600">
	                                            {getTenderItemDisplayName(
	                                              item,
	                                              itemIndex,
	                                            )}
	                                          </span>
	                                          <span
	                                            className={`inline-flex rounded-full px-2.5 py-1 font-semibold ${
	                                              itemRank === "L1"
	                                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
	                                                : itemRank
	                                                  ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
	                                                  : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
	                                            }`}
	                                          >
	                                            {itemRank || "Pending"}
	                                          </span>
	                                        </div>
	                                      );
	                                    })}
	                                  </div>
	                                ) : null}
	                              </div>
	                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              {purchaseApprovalMinutesMeeting?.proceedings_document_path ? (
                                <Button asChild variant="outline" size="sm">
                                  <a
                                    href={toProcurementFileViewUrl(
                                      purchaseApprovalMinutesMeeting.proceedings_document_path,
                                    )}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <Eye className="h-4 w-4" />
                                    View{" "}
                                    {label(
                                      purchaseApprovalMinutesMeeting.meeting_type,
                                    )}
                                  </a>
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled
                                >
                                  Not Uploaded
                                </Button>
                              )}
                            </td>
	                            <td className="whitespace-nowrap px-4 py-3">
	                              <span className="text-xs text-slate-500">
	                                Save from item-wise negotiation card
	                              </span>
	                            </td>
                          </tr>
                        );
                      })}
                      {!commercialQualifiedVendors.length ? (
                        <tr>
                          <td
                            className="px-4 py-6 text-center text-slate-500"
	                            colSpan={8}
                          >
                            No bidder is available in negotiation window.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-4 rounded-[28px] border border-black/8 bg-white p-4 shadow-[0_18px_45px_-40px_rgba(0,0,0,0.45)]">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className={sectionMiniHeadingClass}>
                        Bidder eligible for issuance of the LOA/RC/PO
                      </p>
                      <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                        Allocation against eligible L1 bidder
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-black/56">
                        Select whether the order split is being recorded by
                        quantity or by amount, then enter the allocation for
                        the L1 bidder. Once saved, this basis is frozen for this
                        tender.
                      </p>
                    </div>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                        Order split basis
                      </span>
                      <select
                        className={compactSelectClass}
                        value={effectiveAllocationBasis}
                        onChange={(event) =>
                          setAllocationBasis(event.target.value)
                        }
                        disabled={
                          !canPerformOfficerTenderActions ||
                          isAllocationBasisFrozen
                        }
                      >
                        <option value="quantity">Quantity</option>
                        <option value="amount">Amount</option>
                      </select>
                      {isAllocationBasisFrozen ? (
                        <p className="text-xs font-medium text-emerald-700">
                          Frozen as {label(savedAllocationBasis)} after saved allocation.
                        </p>
                      ) : null}
                    </label>
                    <label className="space-y-1">
                      <span className={sectionMiniHeadingClass}>
                        L1 Consideration
                      </span>
                      <select
                        className={compactSelectClass}
                        value={effectiveAllocationScope}
                        onChange={(event) =>
                          setAllocationScope(event.target.value)
                        }
                        disabled={
                          !canPerformOfficerTenderActions ||
                          isAllocationScopeFrozen
                        }
                      >
                        <option value="overall">Overall</option>
                        <option value="item_wise">Item wise</option>
                      </select>
                      {isAllocationScopeFrozen ? (
                        <p className="text-xs font-medium text-emerald-700">
                          Frozen as {label(savedAllocationScope)} after saved allocation.
                        </p>
                      ) : null}
                    </label>
                  </div>

                  <div className={tableShellClass}>
                    <table className="min-w-full text-left text-sm">
                      <thead className={tableHeadClass}>
                        <tr>
                            <th className={`${stickyFirstHeadClass} px-4 py-3`}>S.No.</th>
                            <th className={`${stickySecondHeadClass} px-4 py-3`}>Name of firm as L1</th>
                          <th className="px-4 py-3">
                            {effectiveAllocationBasis === "amount"
                              ? "Item-wise Amount Allocated"
                              : "Item-wise Qty. Allocated"}
                          </th>
                          <th className="px-4 py-3">Extensions</th>
                          <th className="px-4 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allocationEligibleVendors.map((vendor, index) => {
                          const form = negotiationForms[vendor.id] || {};
                          const extensionForm =
                            allocationExtensionForms[vendor.id] || {};
                          const allocationField =
                            effectiveAllocationBasis === "amount"
                              ? "loa_allocated_amount"
                              : "loa_allocated_quantity";
                          const eligibleItemIds =
                            effectiveAllocationScope === "item_wise"
                              ? itemWiseL1ItemIdsByVendorId[vendor.id] || []
                              : null;
                          return (
                            <>
                              <tr key={vendor.id} className="bg-white align-top">
                                <td className={`${stickyFirstCellClass} px-4 py-3`}>{index + 1}</td>
                                <td className={`${stickySecondCellClass} px-4 py-3 font-medium`}>
                                  {vendor?.firm?.firm_name || "NA"}
                                </td>
                                <td className="px-4 py-3">
                                  {renderVendorItemQuoteEditor(vendor, {
                                    stageKey: `allocation_${allocationField}`,
                                    field: allocationField,
                                    title:
                                      effectiveAllocationBasis === "amount"
                                        ? "Allocated Amount"
                                        : "Allocated Quantity",
                                    totalLabel:
                                      effectiveAllocationBasis === "amount"
                                        ? "Total allocated amount"
                                        : "Total allocated quantity",
                                    buttonLabel:
                                      effectiveAllocationBasis === "amount"
                                        ? "Edit Item-wise Amount"
                                        : "Edit Item-wise Quantity",
                                    hideButtonLabel:
                                      effectiveAllocationBasis === "amount"
                                        ? "Hide Item-wise Amount"
                                        : "Hide Item-wise Quantity",
                                    placeholder:
                                      effectiveAllocationBasis === "amount"
                                        ? "Allocated amount"
                                        : "Allocated quantity",
                                    visibleItemIds: eligibleItemIds,
                                    saveLabel: "Save Allocation",
                                    onSave: saveLoaAllocation,
                                    saving: savingLoaVendorId === vendor.id,
                                  })}
                                </td>
                                <td className="px-4 py-3 text-xs text-black/58">
                                  {(vendor.allocation_extensions || []).length
                                    ? `${vendor.allocation_extensions.length} extension(s)`
                                    : "No extension"}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs text-slate-500">
                                    Save from item-wise allocation card
                                  </span>
                                </td>
                              </tr>
                              <tr className="bg-[#fbfbfd]" key={`${vendor.id}-extension`}>
                                <td className="px-4 py-3" colSpan={5}>
                                  <div className="rounded-[22px] border border-black/8 bg-white p-4 shadow-[0_14px_36px_-34px_rgba(0,0,0,0.45)]">
                                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                      <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40">
                                          Allocation Extension
                                        </p>
                                        <p className="mt-0.5 text-sm text-black/56">
                                          Record approved increase for {vendor?.firm?.firm_name || "this firm"}.
                                        </p>
                                      </div>
                                      <span className="rounded-full bg-[#f5f5f7] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/46 ring-1 ring-black/6">
                                        {effectiveAllocationBasis === "amount" ? "Amount basis" : "Quantity basis"}
                                      </span>
                                    </div>

                                    <div className="grid gap-3 xl:grid-cols-[1fr_12rem_1fr]">
                                      <label className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-black/42">
                                          Approval / Reference
                                        </span>
                                        <Input
                                          value={extensionForm.approval_reference || ""}
                                          onChange={(event) =>
                                            setAllocationExtensionField(
                                              vendor.id,
                                              "approval_reference",
                                              event.target.value,
                                            )
                                          }
                                          placeholder="Approval/reference"
                                        />
                                      </label>

                                      <label className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-black/42">
                                          Approval Date
                                        </span>
                                        <Input
                                          type="date"
                                          value={extensionForm.approval_date || ""}
                                          onChange={(event) =>
                                            setAllocationExtensionField(
                                              vendor.id,
                                              "approval_date",
                                              event.target.value,
                                            )
                                          }
                                        />
                                      </label>

                                      <label className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-black/42">
                                          Remarks
                                        </span>
                                        <Input
                                          value={extensionForm.remarks || ""}
                                          onChange={(event) =>
                                            setAllocationExtensionField(
                                              vendor.id,
                                              "remarks",
                                              event.target.value,
                                            )
                                          }
                                          placeholder="Remarks"
                                        />
                                      </label>
                                    </div>

                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                      {(extensionForm.items || []).map((itemForm, itemIndex) => {
                                        const tenderItem = tenderItems.find(
                                          (item) =>
                                            Number(item.id) ===
                                            Number(itemForm.tender_item_id),
                                        );
                                        const labelText = getTenderItemDisplayName(
                                          tenderItem,
                                          itemIndex,
                                        );
                                        return (
                                          <div
                                            key={`${vendor.id}-${itemForm.tender_item_id}`}
                                            className="rounded-[18px] border border-black/8 bg-[#f8f8fa] p-4"
                                          >
                                            <div className="mb-2">
                                              <p className="text-sm font-semibold text-[#1d1d1f]">
                                                {labelText}
                                              </p>
                                              <p className="text-xs text-black/52">
                                                {tenderItem?.indent_item?.item_name || "NA"}
                                              </p>
                                            </div>
                                            <label className="space-y-1">
                                              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-black/42">
                                                {effectiveAllocationBasis === "amount"
                                                  ? "Extension Amount"
                                                  : "Extension Quantity"}
                                              </span>
                                              <Input
                                                type="number"
                                                min="0"
                                                value={
                                                  effectiveAllocationBasis === "amount"
                                                    ? itemForm.extension_amount || ""
                                                    : itemForm.extension_quantity || ""
                                                }
                                                onChange={(event) =>
                                                  setAllocationExtensionItemField(
                                                    vendor.id,
                                                    itemForm.tender_item_id,
                                                    effectiveAllocationBasis === "amount"
                                                      ? "extension_amount"
                                                      : "extension_quantity",
                                                    event.target.value,
                                                  )
                                                }
                                                placeholder={
                                                  effectiveAllocationBasis === "amount"
                                                    ? "Enter amount"
                                                    : "Enter quantity"
                                                }
                                              />
                                            </label>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                                      <FileAttachmentField
                                        label="Extension Copy"
                                        storedPath={extensionForm.document_path || ""}
                                        onChange={(value) =>
                                          setAllocationExtensionField(
                                            vendor.id,
                                            "document_path",
                                            value,
                                          )
                                        }
                                        onUpload={(file) =>
                                          uploadAllocationExtensionDocument(
                                            vendor.id,
                                            file,
                                          )
                                        }
                                        helperText="Upload mutual consent or approval copy."
                                      />
                                      <Button
                                        type="button"
                                        className={`${primaryButtonClass} lg:mb-2`}
                                        disabled={
                                          savingAllocationExtensionVendorId ===
                                          vendor.id
                                        }
                                        onClick={() =>
                                          saveAllocationExtension(vendor.id)
                                        }
                                      >
                                        {savingAllocationExtensionVendorId === vendor.id
                                          ? "Saving..."
                                          : "Add Extension"}
                                      </Button>
                                    </div>
                                  </div>
                                  {(vendor.allocation_extensions || []).length ? (
                                    <div className="mt-3 overflow-x-auto rounded-[16px] border border-black/8">
                                      <table className="min-w-full text-left text-xs">
                                        <thead className="bg-[#f5f5f7] uppercase tracking-[0.16em] text-black/42">
                                          <tr>
                                            <th className="px-3 py-2">Basis</th>
                                            <th className="px-3 py-2">Item-wise Increase</th>
                                            <th className="px-3 py-2">Approval Ref.</th>
                                            <th className="px-3 py-2">Approval Date</th>
                                            <th className="px-3 py-2">Copy</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-black/6">
                                          {vendor.allocation_extensions.map((entry) => (
                                            <tr key={entry.id}>
                                              <td className="px-3 py-2">
                                                {label(entry.extension_basis)}
                                              </td>
                                              <td className="px-3 py-2 font-medium">
                                                <div className="space-y-1">
                                                  {(Array.isArray(entry.items)
                                                    ? entry.items
                                                    : []
                                                  ).map((item) => (
                                                    <p key={item.id}>
                                                      {getTenderItemDisplayName(
                                                        item?.tender_item,
                                                        tenderItems.findIndex(
                                                          (tenderItem) =>
                                                            Number(tenderItem.id) ===
                                                            Number(item?.tender_item_id),
                                                        ),
                                                      )}
                                                      {" : "}
                                                      {entry.extension_basis === "amount"
                                                        ? money(item.extension_amount)
                                                        : formatPlainNumber(
                                                            item.extension_quantity,
                                                          )}
                                                    </p>
                                                  ))}
                                                </div>
                                              </td>
                                              <td className="px-3 py-2">
                                                {entry.approval_reference || "NA"}
                                              </td>
                                              <td className="px-3 py-2">
                                                {entry.approval_date || "NA"}
                                              </td>
                                              <td className="px-3 py-2">
                                                {entry.document_path ? (
                                                  <Button asChild variant="outline" size="sm">
                                                    <a
                                                      href={toProcurementFileViewUrl(
                                                        entry.document_path,
                                                      )}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                    >
                                                      View
                                                    </a>
                                                  </Button>
                                                ) : (
                                                  "NA"
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            </>
                          );
                        })}
                        {!allocationEligibleVendors.length ? (
                          <tr>
                            <td
                              className="px-4 py-6 text-center text-slate-500"
                              colSpan={4}
                            >
                              Enter final negotiated prices to identify the L1
                              bidder eligible for LOA/RC/PO.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            {selectedStepKey === "purchase_orders" ? (
              <div className="space-y-6">
                {!commercialQualifiedVendors.length ? (
                  <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                    No commercially qualified vendor is available, so PO
                    creation is not open yet for this tender.
                  </div>
                ) : null}

                <div className="space-y-4 rounded-[28px] border border-black/8 bg-white p-4 shadow-[0_18px_45px_-40px_rgba(0,0,0,0.45)]">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className={sectionMiniHeadingClass}>LOA/RC Issue</p>
                      <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                        Has LOA/RC been issued?
                      </h3>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-black/56">
                        Select the issue status first. If LOA or RC is issued,
                        select the L1 vendor or vendors to whom the order is
                        actually being issued.
                      </p>
                    </div>
                    <div className="grid gap-3 lg:min-w-[34rem]">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                          Issue status
                        </span>
                        <select
                          className={compactSelectClass}
                          value={loaRcIssueType}
                          onChange={(event) => {
                            setLoaRcIssueType(event.target.value);
                            if (event.target.value === "not_issued") {
                              setSelectedLoaRcVendorIds([]);
                              setLoaRcVendorPicker("");
                            }
                          }}
                          disabled={!canPerformOfficerTenderActions}
                        >
                          {loaRcIssueOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {isLoaRcIssued ? (
                        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                          <label className="space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                              Select vendor for issue
                            </span>
                            <select
                              className={compactSelectClass}
                              value={loaRcVendorPicker}
                              onChange={(event) =>
                                setLoaRcVendorPicker(event.target.value)
                              }
                              disabled={!canPerformOfficerTenderActions}
                            >
                              <option value="">Select L1 firm</option>
                              {loaRcSelectableVendors.map((vendor) => (
                                <option
                                  key={vendor.id}
                                  value={vendor.id}
                                  disabled={selectedLoaRcVendorIds.includes(
                                    String(vendor.id),
                                  )}
                                >
                                  {vendor?.firm?.firm_name || "NA"}
                                </option>
                              ))}
                            </select>
                          </label>
                          <Button
                            type="button"
                            className={`${primaryButtonClass} self-end`}
                            disabled={
                              !canPerformOfficerTenderActions ||
                              !loaRcVendorPicker
                            }
                            onClick={addLoaRcVendor}
                          >
                            Add Vendor
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {isLoaRcIssued ? (
                    <div className={tableShellClass}>
                      <table className="min-w-max text-left text-sm">
                        <thead className={tableHeadClass}>
                          <tr>
                            <th className="whitespace-nowrap px-4 py-3">
                              S.No.
                            </th>
                            <th className="whitespace-nowrap px-4 py-3">
                              Firm Name
                            </th>
                            <th className="whitespace-nowrap px-4 py-3">
                              {loaRcDateLabel}
                            </th>
                            <th className="whitespace-nowrap px-4 py-3">
                              Upload {loaRcUploadLabel}
                            </th>
                            <th className="whitespace-nowrap px-4 py-3">
                              Remove
                            </th>
                            <th className="whitespace-nowrap px-4 py-3">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {loaRcIssueVendors.map((vendor, index) => (
                            <tr key={vendor.id} className="bg-white align-top">
                              <td className="whitespace-nowrap px-4 py-3">
                                {index + 1}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 font-medium">
                                {vendor?.firm?.firm_name || "NA"}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">
                                <Input
                                  type="date"
                                  value={
                                    negotiationForms[vendor.id]
                                      ?.loa_rc_issue_date || ""
                                  }
                                  onChange={(event) =>
                                    setNegotiationField(
                                      vendor.id,
                                      "loa_rc_issue_date",
                                      event.target.value,
                                    )
                                  }
                                  disabled={!canPerformOfficerTenderActions}
                                  className="min-w-[12rem]"
                                />
                              </td>
                              <td className="min-w-[26rem] px-4 py-3">
                                <FileAttachmentField
                                  label={loaRcUploadLabel}
                                  storedPath={
                                    negotiationForms[vendor.id]
                                      ?.loa_rc_document_path || ""
                                  }
                                  onChange={(value) =>
                                    setNegotiationField(
                                      vendor.id,
                                      "loa_rc_document_path",
                                      value,
                                    )
                                  }
                                  onUpload={uploadLoaRcDocument}
                                  readOnly={!canPerformOfficerTenderActions}
                                  helperText={`Upload signed ${loaRcUploadLabel}.`}
                                />
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">
                                {canPerformOfficerTenderActions ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                    onClick={() => removeLoaRcVendor(vendor.id)}
                                    title="Remove vendor from LOA/RC issue list"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <span className="text-xs text-slate-400">-</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">
                                {canPerformOfficerTenderActions ? (
                                  <Button
                                    className={primaryButtonClass}
                                    disabled={
                                      savingLoaRcVendorId === vendor.id
                                    }
                                    onClick={() =>
                                      saveLoaRcIssue(vendor.id)
                                    }
                                  >
                                    {savingLoaRcVendorId === vendor.id
                                      ? "Saving..."
                                      : "Save Issue"}
                                  </Button>
                                ) : (
                                  <span className="text-xs text-slate-500">
                                    Read only
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {!loaRcIssueVendors.length ? (
                            <tr>
                              <td
                                className="px-4 py-6 text-center text-slate-500"
                                colSpan={6}
                              >
                                Select one or more L1 vendors above to record{" "}
                                {loaRcIssueType === "rc_issued" ? "RC" : "LOA"}{" "}
                                issue details.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className={dashedPanelClass}>
                      LOA/RC has not been issued yet.
                    </div>
                  )}
                </div>

                {canPerformOfficerTenderActions ? (
                  <form
                    className="rounded-[28px] border border-black/8 bg-white p-4 shadow-[0_18px_45px_-42px_rgba(0,0,0,0.45)]"
                    onSubmit={createPo}
                    noValidate
                  >
                    <div className="mb-4 flex flex-col gap-1 border-b border-black/6 pb-3">
                      <p className={sectionMiniHeadingClass}>Purchase Order</p>
                      <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                        Add PO details
                      </h3>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-12">
                      <label className="space-y-1 lg:col-span-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                          Firm
                        </span>
                        <select
                          className={`h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-[#1d1d1f] ${invalidControlClass(poErrors.firm_id)}`}
                          value={poForm.firm_id}
                          onChange={updatePo("firm_id")}
                          aria-invalid={Boolean(poErrors.firm_id)}
                          disabled={!commercialQualifiedVendors.length}
                        >
                          <option value="">Select firm</option>
                          {(isAllocationBasisFrozen
                            ? allocationEligibleVendors
                            : commercialQualifiedVendors
                          ).map((vendor) => (
                            <option key={vendor.id} value={vendor.firm_id}>
                              {vendor?.firm?.firm_name}
                            </option>
                          ))}
                        </select>
                        <FieldError message={poErrors.firm_id} />
                      </label>

                      <label className="space-y-1 lg:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                          PO No.
                        </span>
                        <Input
                          value={poForm.po_no}
                          onChange={updatePo("po_no")}
                          placeholder="Enter PO no."
                          aria-invalid={Boolean(poErrors.po_no)}
                          className={`rounded-xl border-black/10 ${invalidControlClass(poErrors.po_no)}`}
                        />
                        <FieldError message={poErrors.po_no} />
                      </label>

                      <label className="space-y-1 lg:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                          PO Date
                        </span>
                        <Input
                          type="date"
                          value={poForm.po_date}
                          onChange={updatePo("po_date")}
                          aria-invalid={Boolean(poErrors.po_date)}
                          className={`rounded-xl border-black/10 ${invalidControlClass(poErrors.po_date)}`}
                        />
                        <FieldError message={poErrors.po_date} />
                      </label>

                      <label className="space-y-1 lg:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                          PO Value
                        </span>
                        <Input
                          type="number"
                          min="0"
                          value={poForm.po_value}
                          readOnly
                          placeholder="Auto-calculated from item totals"
                          aria-invalid={Boolean(poErrors.po_value)}
                          className={`rounded-xl border-black/10 bg-[#f8f8fb] ${invalidControlClass(poErrors.po_value)}`}
                        />
                        <p className="text-xs leading-5 text-black/48">
                          Auto-filled from the total amount of all PO items.
                        </p>
                        <FieldError message={poErrors.po_value} />
                      </label>

                      <label className="space-y-1 lg:col-span-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                          PO Quantity
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={poForm.po_quantity}
                          onChange={updatePo("po_quantity")}
                          placeholder={
                            tender?.tender_type === "rate_contract" &&
                            tender?.rate_contract_type === "value_based"
                              ? "Optional for value based RC"
                              : selectedPoVendorAllocationBasis === "quantity"
                                ? "Auto-derived from allocated item quantity"
                                : "Enter quantity"
                          }
                          aria-invalid={Boolean(poErrors.po_quantity)}
                          className={`rounded-xl border-black/10 ${invalidControlClass(poErrors.po_quantity)}`}
                          disabled={selectedPoVendorAllocationBasis === "quantity"}
                        />
                        <FieldError message={poErrors.po_quantity} />
                      </label>

                      {selectedPoVendorAllocationSummary ? (
                        <div className="rounded-[20px] bg-[#f5f5f7] p-3 ring-1 ring-black/6 lg:col-span-12">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                            Vendor Allocation Reference
                          </p>
                          {selectedPoVendorAllocationSummary.basis === "quantity" ? (
                            <div className="mt-2 grid gap-3 md:grid-cols-3">
                              <div className="rounded-[16px] bg-white px-3 py-2 ring-1 ring-black/6">
                                <p className="text-xs text-black/46">
                                  Quantity extension approved
                                </p>
                                <p className="mt-1 text-sm font-semibold text-[#1d1d1f]">
                                  {formatPlainNumber(
                                    selectedPoVendorAllocationSummary.quantityExtensionTotal,
                                  )}
                                </p>
                              </div>
                              <div className="rounded-[16px] bg-white px-3 py-2 ring-1 ring-black/6 md:col-span-2">
                                <p className="text-xs text-black/46">
                                  Item-wise remaining allocation for this vendor
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {selectedPoVendorAllocationSummary.itemRows.map((row) => (
                                    <span
                                      key={row.tenderItemId}
                                      className="inline-flex rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-medium text-[#1d4f91]"
                                    >
                                      {row.label}: {formatPlainNumber(row.remainingQuantity)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : selectedPoVendorAllocationSummary.basis === "amount" ? (
                            <div className="mt-2 grid gap-3 md:grid-cols-4">
                              <div className="rounded-[16px] bg-white px-3 py-2 ring-1 ring-black/6">
                                <p className="text-xs text-black/46">Allocated amount</p>
                                <p className="mt-1 text-sm font-semibold text-[#1d1d1f]">
                                  {money(selectedPoVendorAllocationSummary.baseAllocatedAmount)}
                                </p>
                              </div>
                              <div className="rounded-[16px] bg-white px-3 py-2 ring-1 ring-black/6">
                                <p className="text-xs text-black/46">Extension amount</p>
                                <p className="mt-1 text-sm font-semibold text-[#1d1d1f]">
                                  {money(selectedPoVendorAllocationSummary.amountExtensionTotal)}
                                </p>
                              </div>
                              <div className="rounded-[16px] bg-white px-3 py-2 ring-1 ring-black/6">
                                <p className="text-xs text-black/46">Already used in PO</p>
                                <p className="mt-1 text-sm font-semibold text-[#1d1d1f]">
                                  {money(selectedPoVendorAllocationSummary.usedAmount)}
                                </p>
                              </div>
                              <div className="rounded-[16px] bg-white px-3 py-2 ring-1 ring-black/6">
                                <p className="text-xs text-black/46">Remaining amount</p>
                                <p className="mt-1 text-sm font-semibold text-[#1d1d1f]">
                                  {money(selectedPoVendorAllocationSummary.remainingAmount)}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-2 text-sm text-black/56">
                              No saved allocation found yet for this vendor.
                            </p>
                          )}
                        </div>
                      ) : null}

                      <div className="rounded-[22px] bg-[#f5f5f7] p-3 ring-1 ring-black/6 lg:col-span-12">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                              PO Items
                            </p>
	                            <p className="mt-1 text-xs leading-5 text-black/52">
	                              Items are auto-filled from the tender. Make,
	                              model, and unit rate are pulled from the selected
	                              bidder&apos;s negotiated offer in Step 4; quantity
	                              is validated against the vendor allocation saved
	                              in Step 4.
	                            </p>
                          </div>
                          <FieldError message={poErrors.items} />
                        </div>

                        <div className="mt-3 overflow-x-auto rounded-[18px] bg-white ring-1 ring-black/6">
                          <table className="min-w-[1100px] text-left text-sm">
                            <thead className={tableHeadClass}>
                              <tr>
                                <th className="px-3 py-2">Item</th>
                                <th className="px-3 py-2">Make</th>
                                <th className="px-3 py-2">Model</th>
                                <th className="px-3 py-2">Qty</th>
                                <th className="px-3 py-2">Unit Rate</th>
                                <th className="px-3 py-2">GST %</th>
                                <th className="px-3 py-2">Total Amount</th>
                                <th className="px-3 py-2">
                                  Installation Required
                                </th>
                                <th className="px-3 py-2">Remarks</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/6">
                              {poItemForms.map((item, index) => (
                                <tr key={item.tender_item_id || index} className="align-top">
                                  <td className="min-w-[18rem] px-3 py-2">
                                    <p className="font-medium text-[#1d1d1f]">
                                      {item.item_name}
                                    </p>
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-black/50">
                                      {item.item_description || "No description"}
                                    </p>
                                  </td>
	                                  <td className="px-3 py-2">
	                                    <div className="min-w-[9rem] rounded-xl border border-black/10 bg-[#f8f8fb] px-3 py-2 text-sm text-[#1d1d1f]">
	                                      {item.make || "Not recorded"}
	                                    </div>
	                                  </td>
	                                  <td className="px-3 py-2">
	                                    <div className="min-w-[9rem] rounded-xl border border-black/10 bg-[#f8f8fb] px-3 py-2 text-sm text-[#1d1d1f]">
	                                      {item.model || "Not recorded"}
	                                    </div>
	                                  </td>
                                  <td className="px-3 py-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={item.quantity}
                                      onChange={(event) =>
                                        updatePoItem(index, "quantity", event.target.value)
                                      }
                                      className="min-w-[7rem] rounded-xl border-black/10"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={item.unit_rate}
                                      onChange={(event) =>
                                        updatePoItem(index, "unit_rate", event.target.value)
                                      }
                                      placeholder="Rate"
                                      className="min-w-[8rem] rounded-xl border-black/10"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <select
                                      value={item.gst_percentage}
                                      onChange={(event) =>
                                        updatePoItem(index, "gst_percentage", event.target.value)
                                      }
                                      className="h-10 min-w-[7rem] rounded-xl border border-black/10 bg-white px-3 text-sm"
                                    >
                                      <option value="">Select GST</option>
                                      {GST_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                          {option}%
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="min-w-[9rem] rounded-xl border border-black/10 bg-[#f8f8fb] px-3 py-2 text-sm font-medium text-[#1d1d1f]">
                                      {money(calculatePoItemTotalAmount(item))}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <select
                                      className="h-10 min-w-[11rem] rounded-xl border border-black/10 bg-white px-3 text-sm"
                                      value={String(item.installation_required !== false)}
                                      onChange={(event) =>
                                        updatePoItem(
                                          index,
                                          "installation_required",
                                          event.target.value === "true",
                                        )
                                      }
                                    >
                                      <option value="true">Required</option>
                                      <option value="false">Not required</option>
                                    </select>
                                  </td>
                                  <td className="px-3 py-2">
                                    <Input
                                      value={item.remarks}
                                      onChange={(event) =>
                                        updatePoItem(index, "remarks", event.target.value)
                                      }
                                      placeholder="Remarks"
                                      className="min-w-[12rem] rounded-xl border-black/10"
                                    />
                                  </td>
                                </tr>
                              ))}
                              {!poItemForms.length ? (
                                <tr>
                                  <td colSpan={9} className="px-3 py-6 text-center text-sm text-black/52">
                                    No tender item is available for this PO.
                                  </td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-[22px] bg-[#f5f5f7] p-3 ring-1 ring-black/6 lg:col-span-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                          Warranty Period
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <label className="space-y-1">
                            <span className="text-[11px] font-medium text-black/50">
                              Years
                            </span>
                            <Input
                              type="number"
                              min="0"
                              value={poForm.warranty_years}
                              onChange={updatePo("warranty_years")}
                              placeholder="0"
                              aria-invalid={Boolean(poErrors.warranty_years)}
                              className={`rounded-xl border-black/10 bg-white ${invalidControlClass(
                                poErrors.warranty_years,
                              )}`}
                            />
                            <FieldError message={poErrors.warranty_years} />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] font-medium text-black/50">
                              Months
                            </span>
                            <Input
                              type="number"
                              min="0"
                              max="11"
                              value={poForm.warranty_months}
                              onChange={updatePo("warranty_months")}
                              placeholder="0"
                              className="rounded-xl border-black/10 bg-white"
                            />
                          </label>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-black/52">
                          Example: 5 years 3 months. Enter either one or both.
                        </p>
                      </div>

                      <label className="rounded-[22px] bg-[#f5f5f7] p-3 ring-1 ring-black/6 lg:col-span-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                          Warranty Start Date
                        </span>
                        <Input
                          type="date"
                          value={poForm.warranty_start_date}
                          onChange={updatePo("warranty_start_date")}
                          className="mt-2 rounded-xl border-black/10 bg-white"
                        />
                        <p className="mt-2 text-xs leading-5 text-black/52">
                          Optional now. Fill later after delivery or
                          installation.
                        </p>
                      </label>

                      <div className="lg:col-span-5">
                        <FileAttachmentField
                          label="Upload PO Copy"
                          storedPath={poForm.po_document_path}
                          onChange={(value) => {
                            setPoForm((current) => ({
                              ...current,
                              po_document_path: value,
                            }));
                            clearFieldError(setPoErrors, "po_document_path");
                          }}
                          onUpload={uploadPoDocument}
                          error={poErrors.po_document_path}
                          helperText="Upload the signed PO copy."
                        />
                      </div>

                      <div className="flex items-end lg:col-span-12">
                        <Button
                          className={`${primaryButtonClass} h-11 min-w-[10rem]`}
                          disabled={
                            savingPo || !commercialQualifiedVendors.length
                          }
                        >
                          {savingPo ? "Saving..." : "Add PO"}
                        </Button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className={dashedPanelClass}>
                    Purchase order creation is available only to procurement
                    officers and admins.
                  </div>
                )}

                <div className={tableShellClass}>
                  <table className="min-w-full text-left text-sm">
                    <thead className={tableHeadClass}>
                      <tr>
                        <th className="px-4 py-3">PO No.</th>
                            <th className={stickyFirstHeadClass}>Firm</th>
                        <th className="px-4 py-3">PO Date</th>
                        <th className="px-4 py-3">PO Value</th>
                        <th className="px-4 py-3">PO Qty</th>
                        <th className="px-4 py-3">Warranty</th>
                        <th className="px-4 py-3">Warranty Start</th>
                        <th className="px-4 py-3">PO Copy</th>
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
                          <td className="px-4 py-3">{po.po_quantity || "NA"}</td>
                          <td className="px-4 py-3">
                            {po.warranty_period || "NA"}
                          </td>
                          <td className="px-4 py-3">
                            {po.warranty_start_date || "Pending"}
                          </td>
                          <td className="px-4 py-3">
                            {po.po_document_path ? (
                              <Button asChild variant="outline" size="sm">
                                <a
                                  href={toProcurementFileViewUrl(
                                    po.po_document_path,
                                  )}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Eye className="h-4 w-4" />
                                  View
                                </a>
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-400">
                                Not uploaded
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className={lightButtonClass}
                              onClick={() =>
                                navigate(`/purchase-orders/${po.id}`, {
                                  state: tenderReturnState("purchase_orders"),
                                })
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
                            colSpan={9}
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

            {selectedStepKey === "pbg" ? (
              <div className="space-y-6">
                <div className={mutedPanelClass}>
                  <p className={sectionMiniHeadingClass}>Step 6 PBG</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                    PBG policy, receipts, and compliance
                  </h3>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-black/56">
                    Configure one tender-level PBG policy, review vendor
                    obligations, record receipts, and track amount or validity
                    shortfalls from one place.
                  </p>
                </div>

                <div className={sectionShellClass}>
                  <div className="border-b border-black/6 px-6 py-5">
                    <p className={sectionMiniHeadingClass}>PBG Policy</p>
                    <h3 className="mt-1 text-[1.18rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                      Tender-level PBG setup
                    </h3>
                  </div>
                  <div className="space-y-4 px-6 py-5">
                    <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                          PBG Mode
                        </span>
                        <select
                          className={compactSelectClass}
                          value={tenderPbgSetupForm.pbg_mode}
                          onChange={(event) =>
                            setTenderPbgSetupField("pbg_mode", event.target.value)
                          }
                        >
                          <option value="po_wise">PO Wise</option>
                          <option value="contract_value">Contract Value</option>
                          <option value="hybrid">Hybrid</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                          Additional Claim Period
                        </span>
                        <div className="space-y-2">
                          <Input
                            type="number"
                            min="0"
                            value={tenderPbgSetupForm.additional_claim_months}
                            onChange={(event) =>
                              setTenderPbgSetupField(
                                "additional_claim_months",
                                event.target.value,
                              )
                            }
                          />
                          <p className="text-xs leading-5 text-black/52">
                            This is the extra claim/invocation buffer kept after
                            warranty validity. Warning watch stays fixed at 30 days.
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="grid gap-4">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                          Remarks
                        </span>
                        <textarea
                          className={compactTextareaClass}
                          value={tenderPbgSetupForm.remarks}
                          onChange={(event) =>
                            setTenderPbgSetupField("remarks", event.target.value)
                          }
                          rows={2}
                        />
                      </label>
                    </div>

                    <div className="overflow-x-auto rounded-[22px] border border-black/8">
                      <table className="min-w-full text-left text-sm">
                        <thead className={tableHeadClass}>
                          <tr>
                            <th className="px-4 py-3">Firm</th>
                            <th className="px-4 py-3">Allocation Basis</th>
                            <th className="px-4 py-3">Base Contract</th>
                            <th className="px-4 py-3">PBG %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pbgVendorProfiles.map((profile) => (
                            <tr key={profile.vendor_id} className="bg-white">
                              <td className={`${stickyFirstCellClass} px-4 py-3 font-medium`}>
                                {profile?.firm?.firm_name || "NA"}
                              </td>
                              <td className="px-4 py-3">
                                {label(profile.allocation_basis)}
                              </td>
                              <td className="px-4 py-3">
                                {money(profile.base_contract_value)}
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    pbgSetupForms[profile.vendor_id]?.pbg_percentage || ""
                                  }
                                  onChange={(event) =>
                                    setPbgSetupField(
                                      profile.vendor_id,
                                      "pbg_percentage",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Enter percentage"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        className={primaryButtonClass}
                        disabled={savingTenderPbgSetup}
                        onClick={savePbgSetup}
                      >
                        {savingTenderPbgSetup ? "Saving..." : "Save PBG Policy"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className={sectionShellClass}>
                    <div className="border-b border-black/6 px-6 py-5">
                      <p className={sectionMiniHeadingClass}>Firm Obligations</p>
                      <h3 className="mt-1 text-[1.18rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                        Required vs received PBG by firm
                      </h3>
                    </div>
                    <div className="py-5">
                      <div className="overflow-x-auto">
                      <table className="min-w-max text-left text-sm">
                        <thead className={tableHeadClass}>
                          <tr>
                            <th className={`${stickyFirstHeadClass} whitespace-nowrap px-4 py-3`}>
                              S.No.
                            </th>
                            <th
                              className={`${stickySecondHeadClass} whitespace-nowrap px-4 py-3`}
                            >
                              Firm
                            </th>
                            <th className="px-4 py-3">Required</th>
                            <th className="px-4 py-3">Received</th>
                            <th className="px-4 py-3">Short</th>
                            <th className="px-4 py-3">Required Upto</th>
                            <th className="px-4 py-3">Full Coverage Upto</th>
                            <th className="px-4 py-3">Submitted PBG End Dates</th>
                            <th className="whitespace-nowrap px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pbgVendorProfiles.map((profile, index) => (
                            <tr key={profile.vendor_id} className="bg-white">
                              <td className={`${stickyFirstCellClass} whitespace-nowrap px-4 py-3`}>
                                {index + 1}
                              </td>
                              <td
                                className={`${stickySecondCellClass} whitespace-nowrap px-4 py-3 font-medium`}
                              >
                                {profile?.firm?.firm_name || "NA"}
                              </td>
                              <td className="px-4 py-3">
                                {money(profile.total_required_amount)}
                              </td>
                              <td className="px-4 py-3">
                                {money(profile.total_received_amount)}
                              </td>
                              <td
                                className={`px-4 py-3 ${
                                  profile.total_short_amount > 0
                                    ? "font-semibold text-rose-700"
                                    : "text-emerald-700"
                                }`}
                              >
                                {money(profile.total_short_amount)}
                              </td>
                              <td className="px-4 py-3">
                                {profile.required_valid_upto || "Pending PO / warranty"}
                              </td>
                              <td className="px-4 py-3">
                                {profile.current_covered_upto || "NA"}
                              </td>
                              <td className="px-4 py-3">
                                {(pbgReceiptSummariesByFirmId.get(Number(profile.firm_id)) || []).length ? (
                                  <div className="flex min-w-[16rem] flex-col gap-1 text-xs text-slate-600">
                                    {(pbgReceiptSummariesByFirmId.get(Number(profile.firm_id)) || []).map((entry) => (
                                      <span key={entry.id}>{entry.label}</span>
                                    ))}
                                  </div>
                                ) : (
                                  "NA"
                                )}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">
                                <span
                                  className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                                    profile.short_status === "ok"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : profile.short_status === "short_amount"
                                        ? "bg-rose-50 text-rose-700"
                                        : profile.short_status === "short_validity"
                                          ? "bg-amber-50 text-amber-700"
                                          : "bg-rose-50 text-rose-700"
                                  }`}
                                >
                                  {pbgStatusLabel(profile.short_status)}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {!pbgVendorProfiles.length ? (
                            <tr>
                              <td className="px-4 py-6 text-center text-slate-500" colSpan={9}>
                                Complete negotiation and allocation first to start PBG tracking.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  </div>

                  <div className={sectionShellClass}>
                    <div className="border-b border-black/6 px-6 py-5">
                      <p className={sectionMiniHeadingClass}>PBG Receipt</p>
                      <h3 className="mt-1 text-[1.18rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                        Record firm-submitted PBG
                      </h3>
                    </div>
                    <form className="space-y-4 px-6 py-5" onSubmit={createPbgReceipt}>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <label className="space-y-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                            Firm
                          </span>
                          <select
                            className={compactSelectClass}
                            value={pbgReceiptForm.firm_id}
                            onChange={updatePbgReceiptField("firm_id")}
                          >
                            <option value="">Select firm</option>
                            {pbgVendorProfiles.map((profile) => (
                              <option key={profile.vendor_id} value={profile.firm_id}>
                                {profile?.firm?.firm_name || "NA"}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                            Linked PO
                          </span>
                          <select
                            className={compactSelectClass}
                            value={pbgReceiptForm.po_id}
                            onChange={updatePbgReceiptField("po_id")}
                          >
                            <option value="">Contract-level / not linked</option>
                            {selectedPbgReceiptVendorPurchaseOrders.map((po) => (
                              <option key={po.id} value={po.id}>
                                {po.po_no}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                            PBG Amount
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={pbgReceiptForm.pbg_amount}
                            onChange={updatePbgReceiptField("pbg_amount")}
                          />
                        </label>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <label className="space-y-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                            Submission Mode
                          </span>
                          <select
                            className={compactSelectClass}
                            value={pbgReceiptForm.submission_mode}
                            onChange={updatePbgReceiptField("submission_mode")}
                          >
                            <option value="bank_guarantee">Bank Guarantee</option>
                            <option value="dd">Demand Draft</option>
                            <option value="rtgs">RTGS</option>
                            <option value="cash">Cash</option>
                          </select>
                        </label>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                            BG No.
                          </span>
                          <Input
                            value={pbgReceiptForm.bank_guarantee_no}
                            onChange={updatePbgReceiptField("bank_guarantee_no")}
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                            Issuing Bank
                          </span>
                          <Input
                            value={pbgReceiptForm.issuing_bank_name}
                            onChange={updatePbgReceiptField("issuing_bank_name")}
                          />
                        </label>
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <label className="space-y-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                            Issue Date
                          </span>
                          <Input type="date" value={pbgReceiptForm.issue_date} onChange={updatePbgReceiptField("issue_date")} />
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                            Valid Upto
                          </span>
                          <Input type="date" value={pbgReceiptForm.valid_upto} onChange={updatePbgReceiptField("valid_upto")} />
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                            Claim Upto
                          </span>
                          <Input type="date" value={pbgReceiptForm.claim_period_upto} onChange={updatePbgReceiptField("claim_period_upto")} />
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                            Invocation Upto
                          </span>
                          <Input type="date" value={pbgReceiptForm.invocation_upto} onChange={updatePbgReceiptField("invocation_upto")} />
                        </label>
                      </div>

                      <FileAttachmentField
                        label="PBG Document"
                        storedPath={pbgReceiptForm.document_path}
                        onChange={(value) =>
                          setPbgReceiptForm((current) => ({
                            ...current,
                            document_path: value,
                          }))
                        }
                        onUpload={uploadPbgDocument}
                        helperText="Upload the PBG copy or covering letter."
                      />

                      <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/42">
                          Remarks
                        </span>
                        <textarea
                          className={compactTextareaClass}
                          value={pbgReceiptForm.remarks}
                          onChange={updatePbgReceiptField("remarks")}
                          rows={2}
                        />
                      </label>

                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          className={primaryButtonClass}
                          disabled={savingPbgReceipt}
                        >
                          {savingPbgReceipt ? "Saving..." : "Save PBG Receipt"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>

                <div className={sectionShellClass}>
                  <div className="border-b border-black/6 px-6 py-5">
                    <p className={sectionMiniHeadingClass}>PBG Receipts</p>
                    <h3 className="mt-1 text-[1.18rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                      Submitted PBG records
                    </h3>
                  </div>
                  <div className="py-5">
                    <div className="overflow-x-auto">
                    <table className="min-w-max text-left text-sm">
                      <thead className={tableHeadClass}>
                        <tr>
                          <th className={`${stickyFirstHeadClass} whitespace-nowrap px-4 py-3`}>
                            S.No.
                          </th>
                          <th
                            className={`${stickySecondHeadClass} whitespace-nowrap px-4 py-3`}
                          >
                            Firm
                          </th>
                          <th className="px-4 py-3">PO</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Issue Date</th>
                          <th className="px-4 py-3">Valid Upto</th>
                          <th className="px-4 py-3">Claim Upto</th>
                          <th className="px-4 py-3">Invocation</th>
                          <th className="px-4 py-3">Document</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pbgReceipts.map((receipt, index) => (
                          <tr key={receipt.id} className="bg-white">
                            <td className={`${stickyFirstCellClass} whitespace-nowrap px-4 py-3`}>
                              {index + 1}
                            </td>
                            <td
                              className={`${stickySecondCellClass} whitespace-nowrap px-4 py-3`}
                            >
                              {receipt?.firm?.firm_name || "NA"}
                            </td>
                            <td className="px-4 py-3">{receipt?.purchase_order?.po_no || "Contract-level"}</td>
                            <td className="px-4 py-3">{money(receipt.pbg_amount)}</td>
                            <td className="px-4 py-3">{receipt.issue_date || "NA"}</td>
                            <td className="px-4 py-3">{receipt.valid_upto || "NA"}</td>
                            <td className="px-4 py-3">{receipt.claim_period_upto || "NA"}</td>
                            <td className="px-4 py-3">{receipt.invocation_upto || "NA"}</td>
                            <td className="px-4 py-3">
                              {receipt.document_path ? (
                                <div className="flex flex-wrap gap-2">
                                  <a
                                    href={toProcurementFileViewUrl(receipt.document_path)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-black/10 px-3 py-1 text-xs text-[#1d1d1f] hover:bg-[#f5f5f7]"
                                  >
                                    View
                                  </a>
                                  <a
                                    href={toProcurementFileDownloadUrl(receipt.document_path)}
                                    className="rounded-full border border-black/10 px-3 py-1 text-xs text-[#1d1d1f] hover:bg-[#f5f5f7]"
                                  >
                                    Download
                                  </a>
                                </div>
                              ) : (
                                "NA"
                              )}
                            </td>
                          </tr>
                        ))}
                        {!pbgReceipts.length ? (
                          <tr>
                            <td className="px-4 py-6 text-center text-slate-500" colSpan={9}>
                              No PBG receipts recorded yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>

                <div className={sectionShellClass}>
                  <div className="border-b border-black/6 px-6 py-5">
                    <p className={sectionMiniHeadingClass}>Compliance Dashboard</p>
                    <h3 className="mt-1 text-[1.18rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                      Shortfall and expiry watch
                    </h3>
                  </div>
                  <div className="py-5">
                    <div className="overflow-x-auto">
                    <table className="min-w-max text-left text-sm">
                      <thead className={tableHeadClass}>
                        <tr>
                          <th className={`${stickyFirstHeadClass} whitespace-nowrap px-4 py-3`}>
                            S.No.
                          </th>
                          <th
                            className={`${stickySecondHeadClass} whitespace-nowrap px-4 py-3`}
                          >
                            Firm
                          </th>
                          <th className="px-4 py-3">Mode</th>
                          <th className="px-4 py-3">Required</th>
                          <th className="px-4 py-3">Received</th>
                          <th className="px-4 py-3">Short</th>
                          <th className="px-4 py-3">Required Upto</th>
                          <th className="px-4 py-3">Full Coverage Upto</th>
                          <th className="px-4 py-3">Submitted PBG End Dates</th>
                          <th className="px-4 py-3">Days Left</th>
                          <th className="whitespace-nowrap px-4 py-3">Status</th>
                        </tr>
                      </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pbgComplianceRows.map((row, index) => (
                            <tr key={`${row.firm_name}-${index}`} className="bg-white">
                            <td className={`${stickyFirstCellClass} whitespace-nowrap px-4 py-3`}>
                              {index + 1}
                            </td>
                            <td
                              className={`${stickySecondCellClass} whitespace-nowrap px-4 py-3 font-medium`}
                            >
                              {row.firm_name}
                            </td>
                            <td className="px-4 py-3">{label(row.pbg_mode)}</td>
                            <td className="px-4 py-3">{money(row.required_amount)}</td>
                            <td className="px-4 py-3">{money(row.received_amount)}</td>
                            <td className={`px-4 py-3 ${Number(row.short_amount || 0) > 0 ? "font-semibold text-rose-700" : "text-emerald-700"}`}>
                              {money(row.short_amount)}
                            </td>
                            <td className="px-4 py-3">{row.required_valid_upto || "NA"}</td>
                            <td className="px-4 py-3">{row.current_covered_upto || "NA"}</td>
                            <td className="px-4 py-3">
                              {(pbgReceiptSummariesByFirmId.get(Number(row.firm_id)) || []).length ? (
                                <div className="flex min-w-[16rem] flex-col gap-1 text-xs text-slate-600">
                                  {(pbgReceiptSummariesByFirmId.get(Number(row.firm_id)) || []).map((entry) => (
                                    <span key={entry.id}>{entry.label}</span>
                                  ))}
                                </div>
                              ) : (
                                "NA"
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {row.days_left === null || row.days_left === undefined
                                ? "NA"
                                : row.days_left}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${row.status === "ok" ? "bg-emerald-50 text-emerald-700" : row.status === "short_validity" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
                                {pbgStatusLabel(row.status)}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {!pbgComplianceRows.length ? (
                          <tr>
                            <td className="px-4 py-6 text-center text-slate-500" colSpan={11}>
                              No compliance rows yet. Save tender PBG policy to initialize tracking.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

	            {selectedStepKey === "inspection_delivery" ? (
	              renderPoWorkspaceStep({
	                eyebrow: "Inspection & Delivery",
	                title: "PO-wise inspection and delivery workspace",
	                description:
	                  "Select a PO to record consignee locations, inspection, and delivery. Item quantities are checked at each stage on the PO page.",
	                actionLabel: "Open Inspection",
	                emptyMessage: "Add a PO first to start inspection and delivery.",
	                routePath: "inspection-delivery",
	              })
	            ) : null}

	            {selectedStepKey === "installation"
	              ? renderPoWorkspaceStep({
	                  eyebrow: "Installation",
	                  title: "PO-wise installation workspace",
	                  description:
	                    "Open the PO to record normal installation, site-not-ready cases, plug-and-play declaration, or not-required installation against delivered quantities.",
	                  actionLabel: "Open Installation",
	                  emptyMessage: "Add a PO first to start installation tracking.",
	                  routePath: "installation",
	                })
	              : null}

	            {selectedStepKey === "seller_invoice"
	              ? renderPoWorkspaceStep({
	                  eyebrow: "Seller Invoice",
	                  title: "Vendor bill received against PO",
	                  description:
	                    "Open the PO to record seller invoice number, invoice date, invoice copy, and item-wise bill quantities generated from delivery or installation balance.",
	                  actionLabel: "Open Seller Invoice",
	                  emptyMessage: "Add a PO first to record seller invoices.",
	                  routePath: "seller-invoice",
	                })
	              : null}

	            {selectedStepKey === "purchase_invoice"
	              ? renderPoWorkspaceStep({
	                  eyebrow: "Purchase Book/Invoice",
	                  title: "Accounts purchase booking",
	                  description:
	                    "Open the PO to book purchase invoice with voucher number, voucher date, TDS, round off, and purchase bill copy.",
	                  actionLabel: "Open Purchase Book",
	                  emptyMessage: "Add a PO first to book purchase invoices.",
	                  routePath: "purchase-invoice",
	                })
	              : null}

            {selectedStepKey === "sale_invoice"
              ? renderPoWorkspaceStep({
                  eyebrow: "Sale Invoice",
                  title: "Billing to indenting organization",
                  description:
                    "Open the PO to generate sale invoice details with consolidated, consignee-wise, or custom billing and consultancy charges.",
                  actionLabel: "Open Sale Invoice",
                  emptyMessage: "Add a PO first to generate sale invoices.",
                  routePath: "sale-invoice",
                })
              : null}

            {selectedStepKey === "vendor_payment"
              ? renderPoWorkspaceStep({
                  eyebrow: "Firm/Vendor Payment",
                  title: "PO-wise payment release workspace",
                  description:
                    "Open the PO to record vendor payment stage, payment date, amount, payment reference, noting copy, and remarks.",
                  actionLabel: "Open Payment",
                  emptyMessage: "Add a PO first to record vendor payments.",
                  routePath: "vendor-payment",
                })
              : null}
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
