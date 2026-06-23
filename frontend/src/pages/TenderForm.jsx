import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

import FileAttachmentField from "@/components/FileAttachmentField";
import InfoTooltip from "@/components/InfoTooltip";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import FieldError from "@/components/FieldError";
import { Input } from "@/components/ui/input";
import {
  postProcurement,
  procurementRequest,
  uploadProcurementFile,
} from "@/lib/procurement-api";
import { formatCurrencyINR } from "@/lib/amount-format";
import {
  buildRequiredErrors,
  clearFieldError,
  hasErrors,
  invalidControlClass,
} from "@/lib/form-validation";

const initialForm = {
  procurement_case_id: "",
  file_no: "",
  tender_reference_no: "",
  tender_type: "open_tender",
  rate_contract_type: "",
  portal_type: "gem",
  tender_title: "",
  leg_label: "",
  allocation_quantity: "",
  portal_bid_no: "",
  portal_tender_id: "",
  tender_value: "",
  tender_items: [],
  emd_amount: "",
  tender_fee_amount: "",
  bid_publish_date: "",
  bid_submission_date: "",
  price_bid_valid_upto: "",
  technical_bid_validity_applicable: false,
  technical_bid_valid_upto: "",
  location_scope: "PANCHKULA",
  document_path: "",
};

const procurementModeConfig = {
  gem: {
    label: "GeM",
    usesGem: true,
    usesNic: false,
  },
  nic: {
    label: "NIC e-Procurement",
    usesGem: false,
    usesNic: true,
  },
  empanelled: {
    label: "Empanelled Vendor",
    usesGem: false,
    usesNic: false,
  },
  direct_market: {
    label: "Direct Market",
    usesGem: false,
    usesNic: false,
  },
  known_vendor: {
    label: "Known Vendor",
    usesGem: false,
    usesNic: false,
  },
};

const tenderTypeOptions = [
  { value: "open_tender", label: "Open Tender" },
  { value: "limited_tender", label: "Limited Tender" },
  { value: "rate_contract", label: "Rate Contract" },
  { value: "proprietary_tender", label: "Proprietary Tender" },
  { value: "empanelment_tender", label: "Empanelment Tender" },
  { value: "amc_tender", label: "AMC Tender" },
];

const rateContractTypeOptions = [
  { value: "quantity_based", label: "Rate Contract - Quantity Based" },
  { value: "value_based", label: "Rate Contract - Value Based" },
];

const caseModeToTenderMode = {
  tender_gem: "gem",
  tender_nic: "nic",
  tender_split: "gem",
  empanelled_vendor: "empanelled",
  direct_vendor: "known_vendor",
  open_market: "direct_market",
};

const label = (value) =>
  String(value || "NA")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const money = (value) => formatCurrencyINR(value);

function Field({ label, children, hint }) {
  return (
    <label className="space-y-1 text-sm font-medium text-slate-700">
      <span className="inline-flex items-center gap-2">
        <span>{label}</span>
        <InfoTooltip content={hint} />
      </span>
      {children}
    </label>
  );
}

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

const getModeConfig = (mode) =>
  procurementModeConfig[mode] || procurementModeConfig.gem;

const getRequiredFields = (form) => {
  const modeConfig = getModeConfig(form.portal_type);
  const fields = [
    { name: "file_no", label: "File No." },
    { name: "tender_title", label: "Tender Title" },
    { name: "location_scope", label: "Location Scope" },
  ];

  if (modeConfig.usesGem) {
    fields.push({ name: "portal_bid_no", label: "GeM Bid ID" });
  }

  if (modeConfig.usesNic) {
    fields.push(
      { name: "tender_reference_no", label: "Tender Reference No." },
      { name: "portal_tender_id", label: "Tender ID" },
    );
  }

  return fields;
};

const formatQuantity = (value) => {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) return value || "0";
  return Number.isInteger(numeric) ? String(numeric) : String(numeric);
};

const getAlreadyTenderedQuantity = (caseItem) =>
  (Array.isArray(caseItem?.tender_items) ? caseItem.tender_items : []).reduce(
    (sum, tenderItem) => sum + Number(tenderItem?.tender_quantity || 0),
    0,
  );

const getRemainingQuantity = (caseItem) =>
  Math.max(
    Number(caseItem?.indent_item?.quantity || 0) -
      getAlreadyTenderedQuantity(caseItem),
    0,
  );

export default function TenderForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const procurementCaseId = searchParams.get("procurementCaseId") || "";
  const [form, setForm] = useState(() => ({
    ...initialForm,
    procurement_case_id: procurementCaseId,
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [procurementCase, setProcurementCase] = useState(null);
  const [popup, setPopup] = useState({
    open: false,
    type: "info",
    message: "",
  });

  useEffect(() => {
    if (!procurementCaseId) return undefined;

    const loadProcurementCase = async () => {
      try {
        const data = await procurementRequest(
          `/procurement-cases/${procurementCaseId}`,
        );
        setProcurementCase(data);
        const caseItems = Array.isArray(data?.case_items)
          ? data.case_items
          : [];
        setForm((current) => {
          const isSplitCase = data?.procurement_mode === "tender_split";
          const nextPortalType = isSplitCase
            ? current.portal_type === "nic"
              ? "nic"
              : "gem"
            : caseModeToTenderMode[data?.procurement_mode] ||
              current.portal_type;
          const nextModeConfig = getModeConfig(nextPortalType);
          return {
            ...current,
            procurement_case_id: procurementCaseId,
            portal_type: nextPortalType,
            tender_title: current.tender_title || data?.title || "",
            leg_label:
              current.leg_label ||
              (isSplitCase
                ? nextPortalType === "nic"
                  ? "NIC Leg"
                  : "GeM Leg"
                : ""),
            location_scope: data?.location_scope || current.location_scope,
            tender_reference_no: nextModeConfig.usesNic
              ? current.tender_reference_no
              : "",
            portal_tender_id: nextModeConfig.usesNic
              ? current.portal_tender_id
              : "",
            portal_bid_no: nextModeConfig.usesGem ? current.portal_bid_no : "",
            bid_submission_date:
              current.bid_submission_date ||
              toDateTimeLocalValue(data?.bid_submission_date),
            tender_items: caseItems.map((caseItem) => {
              const existing = (current.tender_items || []).find(
                (item) =>
                  Number(item.procurement_case_item_id) ===
                  Number(caseItem.id),
              );
              return {
                procurement_case_item_id: caseItem.id,
                indent_item_id: caseItem?.indent_item?.id || "",
                selected: existing?.selected ?? true,
                tender_quantity:
                  existing?.tender_quantity ??
                  (getRemainingQuantity(caseItem) || ""),
                tender_value: existing?.tender_value || "",
                unit: caseItem?.indent_item?.unit || "",
                remarks: existing?.remarks || "",
              };
            }),
            allocation_quantity: caseItems.length
              ? String(
                  caseItems.reduce(
                    (sum, caseItem) =>
                      sum + getRemainingQuantity(caseItem),
                    0,
                  ),
                )
              : current.allocation_quantity,
            is_split_case: isSplitCase,
          };
        });
      } catch {
        setProcurementCase(null);
      }
    };

    const timer = setTimeout(() => loadProcurementCase(), 0);
    return () => clearTimeout(timer);
  }, [procurementCaseId]);

  const uploadTenderDocument = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadProcurementFile("/files/upload/tender_document", formData);
  };

  const update = (field) => (event) => {
    const value = event.target.value;

    setForm((current) => {
      const next = { ...current, [field]: value };

  if (field === "portal_type") {
        const modeConfig = getModeConfig(value);
        if (!modeConfig.usesGem) {
          next.portal_bid_no = "";
        }
        if (!modeConfig.usesNic) {
          next.tender_reference_no = "";
          next.portal_tender_id = "";
        }
        if (current.is_split_case) {
          next.leg_label = value === "nic" ? "NIC Leg" : "GeM Leg";
        }
      }

      if (field === "tender_type" && value !== "rate_contract") {
        next.rate_contract_type = "";
      }
      if (field === "rate_contract_type" && value === "value_based") {
        next.tender_items = (current.tender_items || []).map((item) => ({
          ...item,
          tender_quantity: "",
        }));
        next.allocation_quantity = "";
      }
      if (field === "technical_bid_validity_applicable") {
        next.technical_bid_validity_applicable = value === "yes";
        if (value !== "yes") {
          next.technical_bid_valid_upto = "";
        }
      }

      return next;
    });

    if (field === "portal_type") {
      setErrors({});
      return;
    }

    clearFieldError(setErrors, field);
  };

  const updateTenderItem = (caseItemId, field, value) => {
    setForm((current) => {
      const tenderItems = (current.tender_items || []).map((item) =>
        Number(item.procurement_case_item_id) === Number(caseItemId)
          ? { ...item, [field]: value }
          : item,
      );
      const totalQuantity = tenderItems.reduce(
        (sum, item) =>
          item.selected === false
            ? sum
            : sum + Number(item.tender_quantity || 0),
        0,
      );
      return {
        ...current,
        tender_items: tenderItems,
        allocation_quantity:
          current.tender_type === "rate_contract" &&
          current.rate_contract_type === "value_based"
            ? ""
            : totalQuantity
              ? String(totalQuantity)
              : "",
      };
    });
    clearFieldError(setErrors, "tender_items");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const modeConfig = getModeConfig(form.portal_type);
    const validationErrors = buildRequiredErrors(form, getRequiredFields(form));
    if (form.tender_type === "rate_contract" && !form.rate_contract_type) {
      validationErrors.rate_contract_type = "Rate contract type is required.";
    }
    if (
      form.technical_bid_validity_applicable &&
      !form.technical_bid_valid_upto
    ) {
      validationErrors.technical_bid_valid_upto =
        "Technical bid validity date is required.";
    }
    if (
      selectedCaseItems.length &&
      !(form.tender_items || []).some(
        (item) =>
          item.selected !== false &&
          (Number(item.tender_quantity || 0) > 0 ||
            Number(item.tender_value || 0) > 0),
      )
    ) {
      validationErrors.tender_items =
        "Select at least one item and enter its tender quantity/value.";
    }
    if (
      selectedCaseItems.length &&
      form.tender_type === "rate_contract" &&
      form.rate_contract_type === "value_based" &&
      !(form.tender_items || []).some(
        (item) => item.selected !== false && Number(item.tender_value || 0) > 0,
      )
    ) {
      validationErrors.tender_items =
        "Enter item-wise tender value for value-based rate contracts.";
    }
    for (const caseItem of selectedCaseItems) {
      const tenderItem = (form.tender_items || []).find(
        (item) =>
          Number(item.procurement_case_item_id) === Number(caseItem.id),
      );
      if (
        tenderItem?.selected !== false &&
        !(form.tender_type === "rate_contract" && form.rate_contract_type === "value_based") &&
        Number(tenderItem?.tender_quantity || 0) >
          getRemainingQuantity(caseItem)
      ) {
        validationErrors.tender_items = `${
          caseItem?.indent_item?.item_name || "Selected item"
        } quantity cannot exceed remaining quantity ${formatQuantity(
          getRemainingQuantity(caseItem),
        )}.`;
        break;
      }
    }
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    setSaving(true);

    try {
      const data = await postProcurement("/tenders", {
        ...form,
        tender_items: (form.tender_items || []).filter(
          (item) => item.selected !== false,
        ),
        procurement_case_id: form.procurement_case_id || null,
        file_no: form.file_no,
        tender_type: form.tender_type,
        rate_contract_type:
          form.tender_type === "rate_contract" ? form.rate_contract_type : "",
        location_scope: "PANCHKULA",
        tender_reference_no: modeConfig.usesNic ? form.tender_reference_no : "",
        portal_tender_id: modeConfig.usesNic ? form.portal_tender_id : "",
        portal_bid_no: modeConfig.usesGem ? form.portal_bid_no : "",
        leg_label: form.is_split_case ? form.leg_label : "",
        allocation_quantity: form.is_split_case ? form.allocation_quantity : "",
        document_path: form.document_path,
        current_submission_deadline: form.bid_submission_date || "",
      });
      navigate(`/tenders/${data.id}`, { replace: true });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to save tender.",
      });
    } finally {
      setSaving(false);
    }
  };

  const modeConfig = getModeConfig(form.portal_type);
  const isSplitCase = procurementCase?.procurement_mode === "tender_split";
  const portalOptions = isSplitCase
    ? Object.entries(procurementModeConfig).filter(
        ([value]) => value === "gem" || value === "nic",
      )
    : Object.entries(procurementModeConfig);
  const selectedCaseItems = Array.isArray(procurementCase?.case_items)
    ? procurementCase.case_items
    : [];
  const selectedTenderItems = (form.tender_items || []).filter(
    (item) => item.selected !== false,
  );
  const selectedTenderItemIds = new Set(
    selectedTenderItems.map((item) => Number(item.procurement_case_item_id)),
  );
  const selectedItemsEstimatedValue = useMemo(
    () =>
      selectedCaseItems.reduce(
        (sum, caseItem) =>
          selectedTenderItemIds.has(Number(caseItem.id))
            ? sum + Number(caseItem?.indent_item?.estimated_amount || 0)
            : sum,
        0,
      ),
    [selectedCaseItems, selectedTenderItemIds],
  );

  return (
    <div className="min-h-full bg-transparent px-4 py-7 text-[#1d1d1f]">
      <div className="mx-auto max-w-[1200px] space-y-5">
        <div className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
          <div className="border-b border-white/10 px-6 py-4">
            <Link
              to="/tenders"
              className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to tenders
            </Link>
          </div>
          <div className="space-y-2 px-6 py-7 md:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">
              Tender Master
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] md:text-[2.7rem]">
              Add Tender
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-white/70">
              Create a tender against the selected procurement case with the
              upstream indent and item value visible for reference.
            </p>
            {procurementCase ? (
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm text-white/74">
                <span>
                  <span className="text-white/38">Indent No.</span>{" "}
                  <span className="font-medium text-white">
                    {procurementCase?.indent?.system_indent_no ||
                      procurementCase?.indent?.indent_no ||
                      "NA"}
                  </span>
                </span>
                <span>
                  <span className="text-white/38">Procurement Case No.</span>{" "}
                  <span className="font-medium text-white">
                    {procurementCase?.case_no || "NA"}
                  </span>
                </span>
                <span>
                  <span className="text-white/38">Selected Items</span>{" "}
                  <span className="font-medium text-white">
                    {selectedTenderItems.length || 0}
                  </span>
                </span>
                <span>
                  <span className="text-white/38">
                    Selected Items Estimated Value
                  </span>{" "}
                  <span className="font-medium text-white">
                    {money(selectedItemsEstimatedValue)}
                  </span>
                </span>
                <span>
                  <span className="text-white/38">Mode</span>{" "}
                  <span className="font-medium text-white">
                    {label(procurementCase?.procurement_mode)}
                  </span>
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <Card className="border-0 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
          <CardContent>
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={handleSubmit}
              noValidate
            >
              {isSplitCase ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:col-span-2">
                  This procurement case is running as a split tender. Create
                  separate tender legs for GeM and NIC, and capture the
                  split quantity for each leg.
                </div>
              ) : null}
              <Field label="Procurement Mode">
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={form.portal_type}
                  onChange={update("portal_type")}
                >
                  {portalOptions.map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tender Type">
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={form.tender_type}
                  onChange={update("tender_type")}
                >
                  {tenderTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              {form.tender_type === "rate_contract" ? (
                <Field label="Rate Contract Type">
                  <select
                    className={`h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm ${invalidControlClass(errors.rate_contract_type)}`}
                    value={form.rate_contract_type}
                    onChange={update("rate_contract_type")}
                    aria-invalid={Boolean(errors.rate_contract_type)}
                  >
                    <option value="">Select rate contract type</option>
                    {rateContractTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.rate_contract_type} />
                </Field>
              ) : null}
              <Field
                label="File No."
                hint="Enter the office file number in which this tender is being processed."
              >
                <Input
                  value={form.file_no}
                  onChange={update("file_no")}
                  aria-invalid={Boolean(errors.file_no)}
                  className={invalidControlClass(errors.file_no)}
                />
                <FieldError message={errors.file_no} />
              </Field>
              {isSplitCase ? (
                <>
                  <Field label="Tender Leg Label">
                    <Input
                      value={form.leg_label}
                      onChange={update("leg_label")}
                      disabled
                    />
                  </Field>
                  <Field
                    label="Quantity"
                    error={errors.allocation_quantity}
                  >
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.allocation_quantity}
                      disabled
                      readOnly
                      aria-invalid={Boolean(errors.allocation_quantity)}
                      className={invalidControlClass(errors.allocation_quantity)}
                    />
                    <FieldError message={errors.allocation_quantity} />
                  </Field>
                </>
              ) : null}
              {selectedCaseItems.length ? (
                <div className="space-y-3 rounded-[24px] bg-[#f5f5f7] p-4 ring-1 ring-black/6 md:col-span-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/42">
                      Tender Items
                    </p>
                    <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#1d1d1f]">
                      {form.tender_type === "rate_contract" &&
                      form.rate_contract_type === "value_based"
                        ? "Mention value for each item covered in this rate contract"
                        : "Mention quantity for each item covered in this tender"}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-black/56">
                      One tender can include multiple procurement-case items.{" "}
                      {form.tender_type === "rate_contract" &&
                      form.rate_contract_type === "value_based"
                        ? "Quantity is optional here. Enter item-wise value so the RC value is traceable per item."
                        : "Enter the quantity being tendered against each item."}
                    </p>
                  </div>
                  <div className="overflow-x-auto rounded-[20px] border border-black/8 bg-white">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-[#f5f5f7] text-[10px] uppercase tracking-[0.2em] text-black/42">
                        <tr>
                          <th className="px-4 py-3">Select</th>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-4 py-3">Indent Qty</th>
                          <th className="px-4 py-3">
                            {form.tender_type === "rate_contract" &&
                            form.rate_contract_type === "value_based"
                              ? "Tender Value"
                              : "Tender Qty"}
                          </th>
                          <th className="px-4 py-3">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/6">
                        {selectedCaseItems.map((caseItem) => {
                          const indentItem = caseItem?.indent_item || {};
                          const tenderItem = (form.tender_items || []).find(
                            (item) =>
                              Number(item.procurement_case_item_id) ===
                              Number(caseItem.id),
                          );
                          const alreadyTenderedQuantity =
                            getAlreadyTenderedQuantity(caseItem);
                          const remainingQuantity =
                            getRemainingQuantity(caseItem);
                          return (
                            <tr key={caseItem.id} className="align-top">
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={tenderItem?.selected !== false}
                                  onChange={(event) =>
                                    updateTenderItem(
                                      caseItem.id,
                                      "selected",
                                      event.target.checked,
                                    )
                                  }
                                  className="mt-1 h-4 w-4 rounded border-black/20"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-semibold text-[#1d1d1f]">
                                  {indentItem.item_name || "NA"}
                                </p>
                                <p className="mt-1 text-xs text-black/52">
                                  {indentItem.category?.category_name ||
                                    "Uncategorized"}{" "}
                                  {indentItem.subcategory?.subcategory_name
                                    ? `| ${indentItem.subcategory.subcategory_name}`
                                    : ""}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-black/62">
                                <p>
                                  {formatQuantity(indentItem.quantity)}{" "}
                                  {indentItem.unit || ""}
                                </p>
                                <p className="mt-1 text-xs text-black/42">
                                  Used:{" "}
                                  {formatQuantity(alreadyTenderedQuantity)} |{" "}
                                  Remaining:{" "}
                                  <span className="font-semibold text-[#1d1d1f]">
                                    {formatQuantity(remainingQuantity)}
                                  </span>
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                {form.tender_type === "rate_contract" &&
                                form.rate_contract_type === "value_based" ? (
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={tenderItem?.tender_value || ""}
                                    disabled={tenderItem?.selected === false}
                                    onChange={(event) =>
                                      updateTenderItem(
                                        caseItem.id,
                                        "tender_value",
                                        event.target.value,
                                      )
                                    }
                                    className="max-w-44"
                                    placeholder="Item RC value"
                                  />
                                ) : (
                                  <Input
                                    type="number"
                                    min="0"
                                    max={remainingQuantity}
                                    step="0.01"
                                    value={tenderItem?.tender_quantity || ""}
                                    disabled={
                                      tenderItem?.selected === false ||
                                      remainingQuantity <= 0
                                    }
                                    onChange={(event) =>
                                      updateTenderItem(
                                        caseItem.id,
                                        "tender_quantity",
                                        event.target.value,
                                      )
                                    }
                                    className="max-w-40"
                                  />
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  value={tenderItem?.remarks || ""}
                                  disabled={tenderItem?.selected === false}
                                  onChange={(event) =>
                                    updateTenderItem(
                                      caseItem.id,
                                      "remarks",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Optional"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <FieldError message={errors.tender_items} />
                </div>
              ) : null}
              <Field label="Tender Title">
                <Input
                  value={form.tender_title}
                  onChange={update("tender_title")}
                  aria-invalid={Boolean(errors.tender_title)}
                  className={invalidControlClass(errors.tender_title)}
                />
                <FieldError message={errors.tender_title} />
              </Field>
              <Field label="Location Scope">
                <Input
                  value={form.location_scope}
                  disabled
                  readOnly
                  aria-invalid={Boolean(errors.location_scope)}
                  className={invalidControlClass(errors.location_scope)}
                />
                <FieldError message={errors.location_scope} />
              </Field>
              {modeConfig.usesGem ? (
                <>
                  <div className="border-t border-slate-200 pt-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 md:col-span-2">
                    GeM Details
                  </div>
                  <Field label="GeM Bid ID">
                    <Input
                      value={form.portal_bid_no}
                      onChange={update("portal_bid_no")}
                      aria-invalid={Boolean(errors.portal_bid_no)}
                      className={invalidControlClass(errors.portal_bid_no)}
                    />
                    <FieldError message={errors.portal_bid_no} />
                  </Field>
                </>
              ) : null}
              {modeConfig.usesNic ? (
                <>
                  <div className="border-t border-slate-200 pt-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 md:col-span-2">
                    NIC e-Procurement Details
                  </div>
                  <Field label="Tender Reference No.">
                    <Input
                      value={form.tender_reference_no}
                      onChange={update("tender_reference_no")}
                      aria-invalid={Boolean(errors.tender_reference_no)}
                      className={invalidControlClass(
                        errors.tender_reference_no,
                      )}
                    />
                    <FieldError message={errors.tender_reference_no} />
                  </Field>
                  <Field label="Tender ID">
                    <Input
                      value={form.portal_tender_id}
                      onChange={update("portal_tender_id")}
                      aria-invalid={Boolean(errors.portal_tender_id)}
                      className={invalidControlClass(errors.portal_tender_id)}
                    />
                    <FieldError message={errors.portal_tender_id} />
                  </Field>
                </>
              ) : null}
              <Field label="Tender Value">
                <Input
                  type="number"
                  min="0"
                  value={form.tender_value}
                  onChange={update("tender_value")}
                />
              </Field>
              <Field label="EMD Amount">
                <Input
                  type="number"
                  min="0"
                  value={form.emd_amount}
                  onChange={update("emd_amount")}
                />
              </Field>
              <Field label="Tender Fee Amount">
                <Input
                  type="number"
                  min="0"
                  value={form.tender_fee_amount}
                  onChange={update("tender_fee_amount")}
                />
              </Field>
              <div className="md:col-span-2">
                <FileAttachmentField
                  label="Tender Document"
                  storedPath={form.document_path}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, document_path: value }))
                  }
                  onUpload={uploadTenderDocument}
                  helperText="Upload the tender document, bid sheet, or approval document."
                />
              </div>
              <Field label="Bid Publish Date">
                <Input
                  type="date"
                  value={form.bid_publish_date}
                  onChange={update("bid_publish_date")}
                />
              </Field>
              <Field
                label="Bid Submission Last Date"
                hint="This means the final last date and time up to which vendors can submit their bid on the portal."
              >
                <Input
                  type="datetime-local"
                  value={form.bid_submission_date}
                  onChange={update("bid_submission_date")}
                />
              </Field>
              <Field
                label="Price / Commercial Bid Valid Upto"
                hint="Also called price validity or bid validity. My Work will warn before expiry."
              >
                <Input
                  type="date"
                  value={form.price_bid_valid_upto}
                  onChange={update("price_bid_valid_upto")}
                />
              </Field>
              <Field
                label="Technical Bid Validity?"
                hint="Use only when the tender specifically has separate technical bid validity."
              >
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={form.technical_bid_validity_applicable ? "yes" : "no"}
                  onChange={update("technical_bid_validity_applicable")}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </Field>
              {form.technical_bid_validity_applicable ? (
                <Field
                  label="Technical Bid Valid Upto"
                  hint="Separate technical validity date, if applicable."
                >
                  <Input
                    type="date"
                    value={form.technical_bid_valid_upto}
                    onChange={update("technical_bid_valid_upto")}
                    aria-invalid={Boolean(errors.technical_bid_valid_upto)}
                    className={invalidControlClass(
                      errors.technical_bid_valid_upto,
                    )}
                  />
                  <FieldError message={errors.technical_bid_valid_upto} />
                </Field>
              ) : null}
              <Button
                className="md:col-span-2 bg-blue-700 text-white hover:bg-blue-800"
                disabled={saving}
              >
                {saving ? <Loader2 className="animate-spin" /> : "Save Tender"}
              </Button>
            </form>
          </CardContent>
        </Card>
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
