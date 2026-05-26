import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Layers3, RotateCcw, Save, SendToBack } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import AppLoader from "@/components/AppLoader";
import FileAttachmentField from "@/components/FileAttachmentField";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  formatCompactIndianAmount,
  formatCurrencyINR,
} from "@/lib/amount-format";
import {
  patchProcurement,
  postProcurement,
  procurementRequest,
  uploadProcurementFile,
} from "@/lib/procurement-api";
import {
  canAccessFeature,
  getCurrentUserProfile,
  getCurrentUserRoles,
  hasAnyRole,
  PMS_ROLES,
} from "@/lib/roles";

const label = (value) =>
  String(value || "NA")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const money = (value) => formatCurrencyINR(value);
const compactMoney = (value) => formatCompactIndianAmount(value);
const formatQuantity = (value) => {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) return value || "0";
  return Number.isInteger(numeric) ? String(numeric) : String(numeric);
};
const assignmentChipClass = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "unassigned") return "bg-rose-100 text-rose-700";
  if (normalized === "assigned" || normalized === "reassigned")
    return "bg-emerald-100 text-emerald-700";
  if (normalized === "returned") return "bg-amber-100 text-amber-700";
  return "bg-slate-200 text-slate-700";
};
const eventLabel = (value) =>
  String(value || "NA")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
const describeTimelineEvent = (event) => {
  const type = String(event?.event_type || "").toLowerCase();
  if (type === "indent_created") return event?.description || "Indent created.";
  if (type === "indent_item_created")
    return event?.description || "Indent item created.";
  if (type === "indent_item_assigned")
    return event?.description || "Indent item assigned.";
  if (type === "indent_item_reassigned")
    return event?.description || "Indent item reassigned.";
  if (type === "indent_item_returned")
    return event?.description || "Indent item returned to admin.";
  if (type === "indent_item_estimated")
    return event?.description || "Estimate recorded for indent item.";
  return event?.description || eventLabel(event?.event_type);
};

const emptyEstimateForm = () => ({
  estimated_rate: "",
  estimated_amount: "",
  remarks: "",
});

const emptyReturnForm = () => ({
  return_reason: "",
  remarks: "",
});

const emptyAdditionalDocumentForm = () => ({
  document_type: "department_communication",
  document_title: "",
  document_path: "",
  remarks: "",
});

const additionalDocumentTypes = [
  { value: "department_communication", label: "Department Communication" },
  { value: "clarification", label: "Clarification" },
  { value: "revised_indent", label: "Revised Indent" },
  { value: "specification", label: "Specification" },
  { value: "administrative_approval", label: "Administrative Approval" },
  { value: "supporting_document", label: "Supporting Document" },
];

const detailShellClass =
  "border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8";
const sectionTitleClass =
  "text-[1.4rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]";
const sectionSubtitleClass = "text-sm text-black/56";
const statLabelClass =
  "text-[10px] font-semibold uppercase tracking-[0.24em] text-black/42";
const mutedPanelClass = "rounded-[22px] bg-[#f5f5f7] ring-1 ring-black/6";
const dashedPanelClass =
  "rounded-[22px] border border-dashed border-black/12 bg-[#f5f5f7] px-4 py-6 text-sm text-black/56";
const actionPrimaryClass =
  "rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]";
const actionSecondaryClass =
  "rounded-full border border-black/10 bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]";
const metaTileClass = "rounded-xl bg-white px-3 py-2 ring-1 ring-black/6";
const metaLabelClass = "text-[10px] uppercase tracking-wide text-black/42";
const metaValueClass = "mt-1 text-sm font-medium text-[#1d1d1f]";

const calculateEstimatedAmount = (item, estimatedRate) => {
  const rate = Number(estimatedRate || 0);
  const quantity = Number(item?.quantity || 0);
  if (!rate || !quantity) return "";
  return String(Number((rate * quantity).toFixed(2)));
};

export default function IndentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [roles] = useState(() => getCurrentUserRoles());
  const [currentUser] = useState(() => getCurrentUserProfile());
  const [indent, setIndent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [assignmentValues, setAssignmentValues] = useState({});
  const [assignmentRemarks, setAssignmentRemarks] = useState({});
  const [estimateForms, setEstimateForms] = useState({});
  const [returnForms, setReturnForms] = useState({});
  const [busyAction, setBusyAction] = useState("");
  const [savingDocuments, setSavingDocuments] = useState(false);
  const [savingAdditionalDocument, setSavingAdditionalDocument] =
    useState(false);
  const [adminApprovalRemarks, setAdminApprovalRemarks] = useState("");
  const [additionalDocumentForm, setAdditionalDocumentForm] = useState(
    emptyAdditionalDocumentForm,
  );
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [popup, setPopup] = useState({
    open: false,
    type: "info",
    message: "",
  });

  const isAdmin = hasAnyRole(roles, [PMS_ROLES.ADMIN, PMS_ROLES.SUPER_ADMIN]);
  const isOfficerFocusedView =
    roles.includes(PMS_ROLES.PROCUREMENT_OFFICER) && !isAdmin;
  const canCreateProcurementCase = canAccessFeature(
    roles,
    "procurementCases",
    "create",
    { allowAdminOverride: false },
  );
  const canManageIndentDocuments =
    isAdmin || roles.includes(PMS_ROLES.ASSOCIATE);
  const officerEmpcode = String(currentUser?.empcode || "").trim();

  const hydrateLocalForms = useCallback((nextIndent) => {
    const items = Array.isArray(nextIndent?.items) ? nextIndent.items : [];

    setAssignmentValues(
      Object.fromEntries(
        items.map((item) => [
          item.id,
          item.assigned_procurement_officer_id
            ? String(item.assigned_procurement_officer_id)
            : "",
        ]),
      ),
    );

    setAssignmentRemarks(
      Object.fromEntries(items.map((item) => [item.id, ""])),
    );

    setEstimateForms(
      Object.fromEntries(
        items.map((item) => [
          item.id,
          {
            estimated_rate: item.estimated_rate
              ? String(item.estimated_rate)
              : "",
            estimated_amount: item.estimated_amount
              ? String(item.estimated_amount)
              : "",
            remarks: item.remarks || "",
          },
        ]),
      ),
    );

    setReturnForms(
      Object.fromEntries(
        items.map((item) => [
          item.id,
          {
            return_reason: item.return_reason || "",
            remarks: item.remarks || "",
          },
        ]),
      ),
    );
  }, []);

  const loadIndent = useCallback(async () => {
    try {
      setLoading(true);
      const data = await procurementRequest(`/indents/${id}`);
      setIndent(data);
      hydrateLocalForms(data);
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to fetch indent.",
      });
    } finally {
      setLoading(false);
    }
  }, [hydrateLocalForms, id]);

  useEffect(() => {
    const timer = setTimeout(() => loadIndent(), 0);
    return () => clearTimeout(timer);
  }, [loadIndent]);

  useEffect(() => {
    setAdminApprovalRemarks(indent?.administrative_approval_remarks || "");
  }, [indent?.administrative_approval_remarks]);

  useEffect(() => {
    if (!isAdmin) {
      setEmployees([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const data = await procurementRequest(
          "/procurement-employees?activeOnly=true",
        );
        setEmployees(
          (Array.isArray(data) ? data : []).filter((employee) =>
            Array.isArray(employee?.assigned_roles)
              ? employee.assigned_roles.includes(PMS_ROLES.PROCUREMENT_OFFICER)
              : false,
          ),
        );
      } catch {
        setEmployees([]);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isAdmin]);

  const items = Array.isArray(indent?.items) ? indent.items : [];
  const procurementCases = Array.isArray(indent?.procurement_cases)
    ? indent.procurement_cases
    : [];
  const timeline = Array.isArray(indent?.timeline) ? indent.timeline : [];
  const additionalDocuments = Array.isArray(indent?.documents)
    ? indent.documents
    : [];

  const visibleItems = useMemo(() => {
    if (!isOfficerFocusedView) return items;
    return items.filter(
      (item) =>
        officerEmpcode &&
        String(item?.procurement_officer?.empcode || "").trim() ===
          officerEmpcode,
    );
  }, [isOfficerFocusedView, items, officerEmpcode]);

  const uploadIndentDocument = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "filename_base",
      `${indent?.indent_no || "indent"}_${indent?.department_name || "organization"}_${indent?.indent_date || "date"}_indent_document`,
    );
    return uploadProcurementFile("/files/upload/indent_document", formData);
  };

  const uploadSpecificationDocument = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "filename_base",
      `${indent?.indent_no || "indent"}_${indent?.department_name || "organization"}_${indent?.indent_date || "date"}_specification_document`,
    );
    return uploadProcurementFile("/files/upload/indent_specification_document", formData);
  };

  const uploadAdministrativeApproval = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "filename_base",
      `${indent?.indent_no || "indent"}_${indent?.department_name || "organization"}_${indent?.indent_date || "date"}_administrative_approval`,
    );
    return uploadProcurementFile("/files/upload/indent_admin_approval", formData);
  };

  const uploadAdditionalIndentDocument = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "filename_base",
      `${indent?.indent_no || "indent"}_${additionalDocumentForm.document_type || "supporting_document"}`,
    );
    return uploadProcurementFile(
      "/files/upload/indent_supporting_document",
      formData,
    );
  };

  const updateIndentDocuments = async (patch) => {
    setSavingDocuments(true);
    try {
      const data = await patchProcurement(`/indents/${id}/documents`, patch);
      setIndent(data);
      hydrateLocalForms(data);
      setPopup({
        open: true,
        type: "success",
        message: "Indent document details updated.",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to update indent document details.",
      });
    } finally {
      setSavingDocuments(false);
    }
  };

  const addIndentDocument = async () => {
    if (!additionalDocumentForm.document_path) {
      setPopup({
        open: true,
        type: "error",
        message: "Please upload a document first.",
      });
      return;
    }

    setSavingAdditionalDocument(true);
    try {
      const data = await postProcurement(`/indents/${id}/documents`, {
        ...additionalDocumentForm,
        actor_empcode: currentUser?.empcode || "",
      });
      setIndent(data);
      hydrateLocalForms(data);
      setAdditionalDocumentForm(emptyAdditionalDocumentForm());
      setPopup({
        open: true,
        type: "success",
        message: "Additional indent document added.",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to add indent document.",
      });
    } finally {
      setSavingAdditionalDocument(false);
    }
  };

  const summaryItems = isOfficerFocusedView ? visibleItems : items;
  const summaryAssignedCount = summaryItems.filter(
    (item) => Number(item?.assigned_procurement_officer_id || 0) > 0,
  ).length;
  const summaryReturnedCount = summaryItems.filter(
    (item) =>
      String(item?.assignment_status || "").toLowerCase() === "returned",
  ).length;
  const summaryEstimatedCount = summaryItems.filter(
    (item) => Number(item?.estimated_amount || 0) > 0,
  ).length;
  const summaryTotalEstimate = summaryItems.reduce(
    (sum, item) => sum + Number(item?.estimated_amount || 0),
    0,
  );
  const allItemsTotalEstimate = items.reduce(
    (sum, item) => sum + Number(item?.estimated_amount || 0),
    0,
  );
  const canOfficerCreateProcurementCase =
    isOfficerFocusedView &&
    visibleItems.length > 0 &&
    visibleItems.every((item) => Number(item?.estimated_amount || 0) > 0);
  const canShowCreateProcurementCase =
    canCreateProcurementCase &&
    (!isOfficerFocusedView || canOfficerCreateProcurementCase);

  const setEstimateField = (itemId, field, value, item = null) => {
    setEstimateForms((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] || emptyEstimateForm()),
        [field]: value,
        ...(field === "estimated_rate" && item
          ? { estimated_amount: calculateEstimatedAmount(item, value) }
          : {}),
      },
    }));
  };

  const setReturnField = (itemId, field, value) => {
    setReturnForms((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] || emptyReturnForm()),
        [field]: value,
      },
    }));
  };

  const runItemAction = async (actionKey, fn, successMessage) => {
    setBusyAction(actionKey);
    try {
      await fn();
      await loadIndent();
      setPopup({ open: true, type: "success", message: successMessage });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to complete action.",
      });
    } finally {
      setBusyAction("");
    }
  };

  if (loading && !indent) {
    return (
      <div className="grid min-h-full place-items-center bg-slate-100">
        <AppLoader fullScreen message="Loading indent..." />
      </div>
    );
  }

  const headerDetailsCard = (
    <Card className={`${detailShellClass} py-0`}>
      <CardContent
        className={isOfficerFocusedView ? "space-y-2.5 p-4" : "space-y-3 p-4"}
      >
        <h2 className={sectionTitleClass}>Indent Info</h2>
        <div
          className="grid gap-2 text-sm text-black/62 md:grid-cols-3"
        >
          <p>
            <span className="font-semibold">PMS Indent No.:</span>{" "}
            {indent?.system_indent_no || "Generating"}
          </p>
          <p>
            <span className="font-semibold">Letter Ref.:</span>{" "}
            {indent?.indent_no || "NA"}
          </p>
          <p>
            <span className="font-semibold">Indent Date:</span>{" "}
            {indent?.indent_date || "NA"}
          </p>
          <p>
            <span className="font-semibold">Indent Received Date:</span>{" "}
            {indent?.received_date || "NA"}
          </p>
          <p>
            <span className="font-semibold">Indent Status:</span>{" "}
            {label(indent?.status)}
          </p>
          <p>
            <span className="font-semibold">Location:</span>{" "}
            {indent?.location_scope || "NA"}
          </p>
          <p>
            <span className="font-semibold">Remarks:</span>{" "}
            {indent?.remarks || "NA"}
          </p>
          <p>
            <span className="font-semibold">Administrative Approval Remarks:</span>{" "}
            {indent?.administrative_approval_remarks || "NA"}
          </p>
        </div>
        <div
          className={`${isOfficerFocusedView ? "grid gap-2 xl:grid-cols-2" : "space-y-3"}`}
        >
          <FileAttachmentField
            label="Indent Document"
            storedPath={indent?.indent_document_path}
            onChange={(value) =>
              updateIndentDocuments({ indent_document_path: value })
            }
            onUpload={uploadIndentDocument}
            readOnly={!canManageIndentDocuments || savingDocuments}
            allowReplace={canManageIndentDocuments}
            allowClear={false}
            emptyLabel="No indent document uploaded."
            helperText="Mandatory inward indent letter received from the indenting organization."
          />
          <FileAttachmentField
            label="Specification File"
            storedPath={indent?.specification_document_path}
            onChange={(value) =>
              updateIndentDocuments({ specification_document_path: value })
            }
            onUpload={uploadSpecificationDocument}
            readOnly={!canManageIndentDocuments || savingDocuments}
            allowReplace={canManageIndentDocuments}
            allowClear={canManageIndentDocuments}
            emptyLabel="No specification file uploaded."
            helperText="Optional specification file. Upload or replace it when received."
          />
          <FileAttachmentField
            label="Administrative Approval Copy"
            storedPath={indent?.administrative_approval_document_path}
            onChange={(value) =>
              updateIndentDocuments({
                administrative_approval_document_path: value,
              })
            }
            onUpload={uploadAdministrativeApproval}
            readOnly={!canManageIndentDocuments || savingDocuments}
            allowReplace={canManageIndentDocuments}
            allowClear={canManageIndentDocuments}
            emptyLabel="No administrative approval copy uploaded."
            helperText="Optional. Upload when received from the organization."
          />
          {canManageIndentDocuments ? (
            <div className="rounded-2xl border border-black/8 bg-[#f5f5f7] p-3">
              <label className="space-y-2">
                <span className="text-sm font-medium text-black/70">
                  Administrative Approval Remarks
                </span>
                <textarea
                  rows={3}
                  value={adminApprovalRemarks}
                  onChange={(event) =>
                    setAdminApprovalRemarks(event.target.value)
                  }
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/10"
                  placeholder="Remarks for administrative approval"
                />
              </label>
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  className={actionPrimaryClass}
                  disabled={savingDocuments}
                  onClick={() =>
                    updateIndentDocuments({
                      administrative_approval_remarks: adminApprovalRemarks,
                    })
                  }
                >
                  Save Remarks
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <details className="rounded-[22px] bg-[#f5f5f7] p-3 ring-1 ring-black/6">
          <summary className="flex cursor-pointer list-none flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1d1d1f]">
                Additional Indent Documents
              </p>
              <p className="text-xs leading-5 text-black/52">
                Upload later communication, revised letters, clarifications, or
                supporting files as one traceable document set.
              </p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/38">
              {additionalDocuments.length} Uploaded
            </span>
          </summary>

          <div className="mt-3">
          {canManageIndentDocuments ? (
            <div className="mt-3 grid gap-2 lg:grid-cols-[0.8fr_1fr_1.2fr]">
              <label className="space-y-1">
                <span className="text-xs font-medium text-black/62">
                  Document Type
                </span>
                <select
                  className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-[#1d1d1f]"
                  value={additionalDocumentForm.document_type}
                  onChange={(event) =>
                    setAdditionalDocumentForm((current) => ({
                      ...current,
                      document_type: event.target.value,
                    }))
                  }
                >
                  {additionalDocumentTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-black/62">
                  Document Title
                </span>
                <Input
                  value={additionalDocumentForm.document_title}
                  onChange={(event) =>
                    setAdditionalDocumentForm((current) => ({
                      ...current,
                      document_title: event.target.value,
                    }))
                  }
                  placeholder="e.g. Department clarification mail"
                />
              </label>
              <div className="lg:row-span-2">
                <FileAttachmentField
                  label="Upload Document"
                  storedPath={additionalDocumentForm.document_path}
                  onChange={(value) =>
                    setAdditionalDocumentForm((current) => ({
                      ...current,
                      document_path: value,
                    }))
                  }
                  onUpload={uploadAdditionalIndentDocument}
                  readOnly={savingAdditionalDocument}
                  allowReplace
                  allowClear
                  emptyLabel="No additional document selected."
                />
              </div>
              <label className="space-y-1 lg:col-span-2">
                <span className="text-xs font-medium text-black/62">
                  Remarks
                </span>
                <textarea
                  rows={2}
                  value={additionalDocumentForm.remarks}
                  onChange={(event) =>
                    setAdditionalDocumentForm((current) => ({
                      ...current,
                      remarks: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/10"
                  placeholder="Short note about this upload"
                />
              </label>
              <div className="flex justify-end lg:col-span-3">
                <Button
                  type="button"
                  size="sm"
                  className={actionPrimaryClass}
                  disabled={
                    savingAdditionalDocument ||
                    !additionalDocumentForm.document_path
                  }
                  onClick={addIndentDocument}
                >
                  {savingAdditionalDocument ? "Adding..." : "Add Document"}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-3 space-y-2">
            {additionalDocuments.map((document) => (
              <FileAttachmentField
                key={document.id}
                label={
                  document.document_title ||
                  label(document.document_type || "Document")
                }
                storedPath={document.document_path}
                readOnly
                emptyLabel="Document path missing."
                helperText={[
                  label(document.document_type),
                  document.remarks,
                  document.uploader?.employee_name
                    ? `Uploaded by ${document.uploader.employee_name}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" | ")}
              />
            ))}
            {!additionalDocuments.length ? (
              <div className="rounded-2xl border border-dashed border-black/12 bg-white px-4 py-4 text-sm text-black/50">
                No additional communication/supporting document has been added
                yet.
              </div>
            ) : null}
          </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );

  const linkedCasesCard = (
    <Card className={detailShellClass}>
      <CardContent
        className={isOfficerFocusedView ? "space-y-2.5 p-4" : "space-y-3"}
      >
        <div className="flex flex-col gap-2.5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className={sectionTitleClass}>Linked Procurement Cases</h2>
            <p className={sectionSubtitleClass}>
              Cases already opened against this indent.
            </p>
          </div>
          {canShowCreateProcurementCase ? (
            <Button
              type="button"
              className={actionPrimaryClass}
              onClick={() =>
                navigate(`/procurement-cases/new?indentId=${indent?.id}`)
              }
            >
              <Layers3 className="mr-2 h-4 w-4" />
              Create Procurement Case
            </Button>
          ) : null}
        </div>
        {procurementCases.length ? (
          <div
            className={`${isOfficerFocusedView ? "grid gap-2 xl:grid-cols-2" : "space-y-3"}`}
          >
            {procurementCases.map((procurementCase) => (
              <button
                key={procurementCase.id}
                type="button"
                onClick={() =>
                  navigate(`/procurement-cases/${procurementCase.id}`)
                }
                className={`w-full rounded-[22px] bg-[#f5f5f7] text-left ring-1 ring-black/6 transition hover:bg-[#eef6ff] ${isOfficerFocusedView ? "p-3" : "p-4"}`}
              >
                <p className="text-sm font-semibold text-[#1d1d1f]">
                  {procurementCase.case_no}
                </p>
                <p className="mt-1 text-sm text-black/56">
                  {procurementCase.title}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wide text-black/42">
                  {label(procurementCase.procurement_mode)} |{" "}
                  {label(procurementCase.status)}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className={dashedPanelClass}>
            No procurement case is linked yet. Use the button above when
            item-level handling is ready.
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
      <div className="min-h-full bg-transparent px-4 py-7 text-[#1d1d1f]">
        <div className="mx-auto max-w-[1500px] space-y-5">
          <div className="overflow-hidden rounded-[30px] bg-black text-white shadow-[0_24px_60px_-42px_rgba(0,0,0,0.72)]">
            <div className="border-b border-white/10 px-6 py-3.5 md:px-7">
              <Link
                to="/indents"
                className="inline-flex items-center gap-2 text-sm font-medium text-white/68 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to indents
              </Link>
            </div>
            <div className="flex flex-col gap-5 px-6 py-5 md:px-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/42">
                  Indent Workflow
                </p>
                <h1 className="mt-2 max-w-5xl text-[2.15rem] font-semibold tracking-[-0.04em] text-white md:text-[3.2rem] md:leading-[1.03]">
                  {indent?.indent_no}
                </h1>
                <p className="mt-2 max-w-4xl text-[15px] text-white/66 md:text-[17px]">
                  Indenting Organization: {indent?.department_name || "NA"} • CFMS No. {indent?.cfms_no || "NA"}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/74">
                  <span>
                    <span className="text-white/38">Status</span>{" "}
                    <span className="font-medium text-white">
                      {label(indent?.status)}
                    </span>
                  </span>
                  <span>
                    <span className="text-white/38">Received</span>{" "}
                    <span className="font-medium text-white">
                      {indent?.received_date || "NA"}
                    </span>
                  </span>
                  <span>
                    <span className="text-white/38">Indent Date</span>{" "}
                    <span className="font-medium text-white">
                      {indent?.indent_date || "NA"}
                    </span>
                  </span>
                  <span>
                    <span className="text-white/38">Location</span>{" "}
                    <span className="font-medium text-white">
                      {indent?.location_scope || "NA"}
                    </span>
                  </span>
                </div>
                {isOfficerFocusedView && !canOfficerCreateProcurementCase ? (
                  <p className="mt-3 text-sm text-[#ffd27d]">
                    Record estimated value for all items currently assigned to
                    you before creating a procurement case.
                  </p>
                ) : null}
              </div>

              <div className="shrink-0 space-y-3 lg:pl-8">
                {timeline.length || canShowCreateProcurementCase ? (
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {timeline.length ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full border-white/20 bg-white/6 text-white hover:bg-white/10"
                        onClick={() => setTimelineOpen(true)}
                      >
                        View Indent Timeline
                      </Button>
                    ) : null}
                    {canShowCreateProcurementCase ? (
                      <Button
                        type="button"
                        className="rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]"
                        onClick={() =>
                          navigate(
                            `/procurement-cases/new?indentId=${indent?.id}`,
                          )
                        }
                      >
                        <Layers3 className="mr-2 h-4 w-4" />
                        Create Procurement Case
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <section className="border-b border-black/8 pb-3 pt-1">
            <div
              className={`${isOfficerFocusedView ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-5" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-5"}`}
            >
              {[
                ["Items", summaryItems.length || 0, null],
                ["Assigned", summaryAssignedCount || 0, null],
                ["Returned", summaryReturnedCount || 0, null],
                ["Estimated", summaryEstimatedCount || 0, null],
                isOfficerFocusedView
                  ? [
                      "Assigned Items Estimate",
                      compactMoney(summaryTotalEstimate),
                      money(summaryTotalEstimate),
                      `Total Estimate: ${money(allItemsTotalEstimate)}`,
                    ]
                  : [
                      "Total Estimate",
                      compactMoney(summaryTotalEstimate),
                      money(summaryTotalEstimate),
                      null,
                    ],
              ].map(([title, value, fullValue, helper]) => (
                <div
                  key={title}
                  className="rounded-[20px] bg-white px-4 py-3 shadow-[0_12px_30px_-24px_rgba(0,0,0,0.35)] ring-1 ring-black/6"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-black/34">
                    {title}
                  </span>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <span
                      className="text-[2.2rem] leading-none font-semibold tracking-[-0.07em] text-[#1d1d1f]"
                      title={fullValue || undefined}
                    >
                      {value}
                    </span>
                  </div>
                  {helper ? (
                    <p className="mt-2 text-xs font-medium text-black/44">
                      {helper}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            {headerDetailsCard}
            {linkedCasesCard}

            <Card className={detailShellClass}>
              <CardContent
                className={isOfficerFocusedView ? "space-y-3 p-4" : "space-y-4"}
              >
                <details>
                  <summary className="cursor-pointer list-none">
                    <div>
                      <h2 className={sectionTitleClass}>Indent Items Workflow</h2>
                      <p className={sectionSubtitleClass}>
                        Click to review item assignment, estimates, return notes, and procurement movement.
                      </p>
                    </div>
                  </summary>

                <div
                  className={`${isOfficerFocusedView ? "space-y-3" : "space-y-4"} mt-4`}
                >
                  {visibleItems.map((item, index) => {
                    const itemId = item.id;
                    const assignmentValue = assignmentValues[itemId] ?? "";
                    const estimateForm =
                      estimateForms[itemId] || emptyEstimateForm();
                    const returnForm = returnForms[itemId] || emptyReturnForm();
                    const assignmentStatus = String(
                      item?.assignment_status || "",
                    ).toLowerCase();
                    const isReturnedItem = assignmentStatus === "returned";
                    const isMyAssignedItem =
                      officerEmpcode &&
                      String(
                        item?.procurement_officer?.empcode || "",
                      ).trim() === officerEmpcode;
                    const canWorkOnItem =
                      roles.includes(PMS_ROLES.PROCUREMENT_OFFICER) &&
                      isMyAssignedItem;

                    return (
                      <div
                        key={itemId}
                        className={`rounded-[24px] bg-white p-3 shadow-[0_18px_40px_-34px_rgba(0,0,0,0.22)] ring-1 ring-black/8 ${isOfficerFocusedView ? "" : "md:p-4"}`}
                      >
                        <div
                          className={`flex flex-col ${isOfficerFocusedView ? "gap-2" : "gap-3"} md:flex-row md:items-start md:justify-between`}
                        >
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/42">
                              Item {index + 1}
                            </p>
                            <h3
                              className={`${isOfficerFocusedView ? "text-base" : "text-lg"} font-semibold text-[#1d1d1f]`}
                            >
                              {item.category?.category_name || "Uncategorized"}{" "}
                              | {item.subcategory?.subcategory_name || "NA"}
                            </h3>
                            <p
                              className={`${isOfficerFocusedView ? "mt-0.5 text-xs" : "mt-1 text-[15px]"} font-medium text-black/58`}
                            >
                              {item.item_name || "Item name not available"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
                            <span
                              className={`rounded-full px-3 py-1 ${assignmentChipClass(item.assignment_status)}`}
                            >
                              {label(item.assignment_status)}
                            </span>
                            <span className="rounded-full bg-[#f0f7ff] px-3 py-1 text-[#0066cc]">
                              {label(item.procurement_decision_status)}
                            </span>
                          </div>
                        </div>

                        <div
                          className={`${isOfficerFocusedView ? "mt-2 grid gap-1.5 md:grid-cols-4 xl:grid-cols-9" : "mt-3 grid gap-2 md:grid-cols-3"}`}
                        >
                          <div
                            className={`${metaTileClass} ${isOfficerFocusedView ? "px-2.5 py-1.5" : ""}`}
                          >
                            <p className={metaLabelClass}>Category</p>
                            <p className={metaValueClass}>
                              {item.category?.category_name || "Uncategorized"}
                            </p>
                          </div>
                          <div
                            className={`${metaTileClass} ${isOfficerFocusedView ? "px-2.5 py-1.5" : ""}`}
                          >
                            <p className={metaLabelClass}>Sub Category</p>
                            <p className={metaValueClass}>
                              {item.subcategory?.subcategory_name || "NA"}
                            </p>
                          </div>
                          <div
                            className={`${metaTileClass} ${isOfficerFocusedView ? "px-2.5 py-1.5" : ""}`}
                          >
                            <p className={metaLabelClass}>Quantity</p>
                            <p className={metaValueClass}>
                              {formatQuantity(item.quantity)} {item.unit}
                            </p>
                          </div>
                          <div
                            className={`${metaTileClass} ${isOfficerFocusedView ? "px-2.5 py-1.5" : ""}`}
                          >
                            <p className={metaLabelClass}>Specific Make</p>
                            <p className={metaValueClass}>
                              {item.specific_make_required ? "Yes" : "No"}
                            </p>
                          </div>
                          <div
                            className={`${metaTileClass} ${isOfficerFocusedView ? "px-2.5 py-1.5" : ""}`}
                          >
                            <p className={metaLabelClass}>Assigned Officer</p>
                            <p className={metaValueClass}>
                              {item.procurement_officer?.employee_name ||
                                "Unassigned"}
                            </p>
                          </div>
                          <div
                            className={`${metaTileClass} ${isOfficerFocusedView ? "px-2.5 py-1.5" : ""}`}
                          >
                            <p className={metaLabelClass}>
                              Administrative Approval
                            </p>
                            <p className={metaValueClass}>
                              {item.administrative_approval_required
                                ? "Required"
                                : "Not Required"}
                            </p>
                          </div>
                          <div
                            className={`${metaTileClass} ${isOfficerFocusedView ? "px-2.5 py-1.5" : ""}`}
                          >
                            <p className={metaLabelClass}>
                              Specific Make / Company
                            </p>
                            <p className={metaValueClass}>
                              {item.preferred_make || "NA"}
                            </p>
                          </div>
                          <div
                            className={`${metaTileClass} ${isOfficerFocusedView ? "px-2.5 py-1.5" : ""}`}
                          >
                            <p className={metaLabelClass}>Estimated Value</p>
                            <p
                              className={metaValueClass}
                              title={money(item.estimated_amount)}
                            >
                              {compactMoney(item.estimated_amount)}
                            </p>
                          </div>
                          <div
                            className={`${metaTileClass} ${isOfficerFocusedView ? "px-2.5 py-1.5" : ""}`}
                          >
                            <p className={metaLabelClass}>Estimated By</p>
                            <p className={metaValueClass}>
                              {item.estimated_by_officer?.employee_name ||
                                "Pending"}
                            </p>
                          </div>
                        </div>

                        {item.return_reason ? (
                          <div
                            className={`mt-2 rounded-[20px] bg-[#fff6f6] ring-1 ring-rose-200 ${isOfficerFocusedView ? "px-3 py-2" : "px-4 py-3"}`}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                              Return Reason
                            </p>
                            <p className="mt-1 text-sm text-rose-900">
                              {item.return_reason}
                            </p>
                          </div>
                        ) : null}

                        {isAdmin ? (
                          <div className="mt-4 rounded-[20px] bg-[#f5f5f7] p-4 ring-1 ring-black/6">
                            <div className="mb-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/42">
                                Admin Control
                              </p>
                              <p className="mt-1 text-sm text-black/56">
                                Assign or change the procurement officer
                                responsible for this indent item.
                              </p>
                            </div>
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                              <label className="flex-1 space-y-1">
                                <span className="text-sm font-medium text-black/62">
                                  Assign Procurement Officer
                                </span>
                                <select
                                  className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-[#1d1d1f]"
                                  value={assignmentValue}
                                  onChange={(event) =>
                                    setAssignmentValues((current) => ({
                                      ...current,
                                      [itemId]: event.target.value,
                                    }))
                                  }
                                >
                                  <option value="">
                                    Select Procurement Officer
                                  </option>
                                  {employees.map((employee) => (
                                    <option
                                      key={employee.id}
                                      value={employee.id}
                                    >
                                      {employee.employee_name} (
                                      {employee.empcode})
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="flex-1 space-y-1">
                                <span className="text-sm font-medium text-black/62">
                                  Assignment Remarks
                                </span>
                                <textarea
                                  rows={2}
                                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1d1d1f]"
                                  value={assignmentRemarks[itemId] || ""}
                                  onChange={(event) =>
                                    setAssignmentRemarks((current) => ({
                                      ...current,
                                      [itemId]: event.target.value,
                                    }))
                                  }
                                  placeholder="Reason, priority, or instruction for this assignment"
                                />
                              </label>
                              <Button
                                type="button"
                                className={actionPrimaryClass}
                                disabled={
                                  !assignmentValue ||
                                  busyAction === `assign-${itemId}`
                                }
                                onClick={() =>
                                  (() => {
                                    const currentOfficerId = String(
                                      item?.assigned_procurement_officer_id ||
                                        "",
                                    );
                                    const isChangingExistingOfficer =
                                      currentOfficerId &&
                                      currentOfficerId !==
                                        String(assignmentValue);

                                    if (
                                      isChangingExistingOfficer &&
                                      !window.confirm(
                                        "Do you really want to change the assigned officer for this item?",
                                      )
                                    ) {
                                      return;
                                    }

                                    runItemAction(
                                      `assign-${itemId}`,
                                      () =>
                                        patchProcurement(
                                          `/indents/items/${itemId}/assign`,
                                          {
                                            actor_empcode:
                                              currentUser?.empcode || "",
                                            actor_name:
                                              currentUser?.fullName || "",
                                            procurement_officer_id:
                                              assignmentValue,
                                            remarks:
                                              assignmentRemarks[itemId] || "",
                                          },
                                        ),
                                      "Indent item assignment updated successfully.",
                                    );
                                  })()
                                }
                              >
                                <SendToBack className="mr-2 h-4 w-4" />
                                {busyAction === `assign-${itemId}`
                                  ? "Saving..."
                                  : Number(
                                        item?.assigned_procurement_officer_id ||
                                          0,
                                      ) > 0
                                    ? "Change Assignment"
                                    : "Save Assignment"}
                              </Button>
                            </div>
                            <p className="mt-3 text-xs text-black/42">
                              Admin can change the assigned officer at any time.
                              The system will ask for confirmation before
                              changing an already assigned item.
                            </p>
                          </div>
                        ) : null}

                        {canWorkOnItem ? (
                          <div
                            className={`mt-3 grid gap-3 ${isOfficerFocusedView ? "xl:grid-cols-[1.1fr_0.9fr]" : "xl:grid-cols-[1fr_0.95fr]"}`}
                          >
                            <div
                              className={`rounded-[22px] bg-[#f6fbf7] ring-1 ring-emerald-200 ${isOfficerFocusedView ? "p-2.5" : "p-4"}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-emerald-950">
                                    Estimate This Item
                                  </p>
                                  <p className="mt-0.5 text-xs text-emerald-800/80">
                                    Record rate and value so the item can move
                                    forward into procurement planning.
                                  </p>
                                </div>
                                <span className="text-[11px] uppercase tracking-wide text-emerald-700">
                                  Officer Action
                                </span>
                              </div>
                              <div
                                className={`mt-3 grid ${isOfficerFocusedView ? "gap-1.5 lg:grid-cols-[0.7fr_0.8fr_1fr_auto]" : "gap-3 md:grid-cols-2"}`}
                              >
                                <label className="space-y-1">
                                  <span className="text-xs font-medium text-black/62">
                                    Estimated value per unit
                                  </span>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={estimateForm.estimated_rate}
                                    onChange={(event) =>
                                      setEstimateField(
                                        itemId,
                                        "estimated_rate",
                                        event.target.value,
                                        item,
                                      )
                                    }
                                    className={
                                      isOfficerFocusedView ? "h-8" : ""
                                    }
                                  />
                                </label>
                                <label className="space-y-1">
                                  <span className="text-xs font-medium text-black/62">
                                    Estimated total value
                                  </span>
                                  <Input
                                    type="number"
                                    value={
                                      estimateForm.estimated_amount ||
                                      calculateEstimatedAmount(
                                        item,
                                        estimateForm.estimated_rate,
                                      )
                                    }
                                    disabled
                                    readOnly
                                    placeholder="Auto calculated"
                                    className={
                                      isOfficerFocusedView ? "h-8" : ""
                                    }
                                  />
                                </label>
                                <label className="space-y-1 lg:col-span-1">
                                  <span className="text-xs font-medium text-black/62">
                                    Officer Remarks
                                  </span>
                                  <textarea
                                    rows={isOfficerFocusedView ? 1 : 3}
                                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1d1d1f]"
                                    value={estimateForm.remarks}
                                    onChange={(event) =>
                                      setEstimateField(
                                        itemId,
                                        "remarks",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </label>
                                <div className="flex items-end lg:pb-0.5">
                                  <Button
                                    type="button"
                                    className={`rounded-full bg-emerald-600 text-white hover:bg-emerald-700 ${isOfficerFocusedView ? "h-8 px-3 text-xs" : ""}`}
                                    disabled={
                                      !estimateForm.estimated_rate ||
                                      busyAction === `estimate-${itemId}`
                                    }
                                    onClick={() =>
                                      runItemAction(
                                        `estimate-${itemId}`,
                                        () =>
                                          patchProcurement(
                                            `/indents/items/${itemId}/estimate`,
                                            {
                                              actor_empcode: officerEmpcode,
                                              actor_name:
                                                currentUser?.fullName || "",
                                              estimated_rate:
                                                estimateForm.estimated_rate,
                                              estimated_amount:
                                                estimateForm.estimated_amount,
                                              remarks: estimateForm.remarks,
                                            },
                                          ),
                                        "Estimated value updated successfully.",
                                      )
                                    }
                                  >
                                    <Save className="mr-2 h-4 w-4" />
                                    {busyAction === `estimate-${itemId}`
                                      ? "Saving..."
                                      : "Save"}
                                  </Button>
                                </div>
                              </div>
                            </div>

                            <div
                              className={`rounded-[22px] bg-[#fff6f6] ring-1 ring-rose-200 ${isOfficerFocusedView ? "p-2.5" : "p-4"}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-rose-950">
                                    Return Item To Admin
                                  </p>
                                  <p className="mt-0.5 text-xs text-rose-800/80">
                                    Send the item back with a clear reason when
                                    procurement action should not continue
                                    as-is.
                                  </p>
                                </div>
                                <span className="text-[11px] uppercase tracking-wide text-rose-700">
                                  Officer Action
                                </span>
                              </div>
                              <div
                                className={`mt-3 grid gap-1.5 ${isOfficerFocusedView ? "lg:grid-cols-[1.2fr_0.95fr_auto]" : ""}`}
                              >
                                <label className="block space-y-1">
                                  <span className="text-xs font-medium text-black/62">
                                    Reason for return
                                  </span>
                                  <textarea
                                    rows={isOfficerFocusedView ? 1 : 3}
                                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1d1d1f]"
                                    value={returnForm.return_reason}
                                    onChange={(event) =>
                                      setReturnField(
                                        itemId,
                                        "return_reason",
                                        event.target.value,
                                      )
                                    }
                                    placeholder="Mention non-related scope, availability issue, duplication, or any other reason..."
                                  />
                                </label>
                                <label className="block space-y-1">
                                  <span className="text-xs font-medium text-black/62">
                                    Supporting remarks
                                  </span>
                                  <textarea
                                    rows={isOfficerFocusedView ? 1 : 2}
                                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1d1d1f]"
                                    value={returnForm.remarks}
                                    onChange={(event) =>
                                      setReturnField(
                                        itemId,
                                        "remarks",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </label>
                                <div className="flex items-end lg:pb-0.5">
                                  <Button
                                    type="button"
                                    className={`rounded-full bg-rose-600 text-white hover:bg-rose-700 ${isOfficerFocusedView ? "h-8 px-3 text-xs" : ""}`}
                                    disabled={
                                      !returnForm.return_reason ||
                                      busyAction === `return-${itemId}`
                                    }
                                    onClick={() =>
                                      runItemAction(
                                        `return-${itemId}`,
                                        () =>
                                          patchProcurement(
                                            `/indents/items/${itemId}/return`,
                                            {
                                              actor_empcode: officerEmpcode,
                                              actor_name:
                                                currentUser?.fullName || "",
                                              return_reason:
                                                returnForm.return_reason,
                                              remarks: returnForm.remarks,
                                            },
                                          ),
                                        "Indent item returned to admin successfully.",
                                      )
                                    }
                                  >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    {busyAction === `return-${itemId}`
                                      ? "Returning..."
                                      : "Return"}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                </details>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      {timelineOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/42 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-[30px] bg-white shadow-[0_30px_80px_-44px_rgba(0,0,0,0.65)] ring-1 ring-black/8">
            <div className="flex items-center justify-between border-b border-black/6 px-6 py-4">
              <div>
                <h2 className={sectionTitleClass}>Indent Timeline</h2>
                <p className={sectionSubtitleClass}>
                  Full movement history for this indent, including assignment,
                  return, and estimate events.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className={actionSecondaryClass}
                onClick={() => setTimelineOpen(false)}
              >
                Close
              </Button>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto px-6 py-5">
              {timeline.map((event) => (
                <div
                  key={`${event.scope}-${event.id}`}
                  className="rounded-[22px] bg-[#f5f5f7] px-4 py-3 ring-1 ring-black/6"
                >
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#1d1d1f]">
                        {eventLabel(event.event_type)}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-black/42">
                        {event.item_name
                          ? `${event.item_name}${event.quantity ? ` (${formatQuantity(event.quantity)} ${event.unit || ""})` : ""}`
                          : "Indent level event"}
                      </p>
                    </div>
                    <p className="text-xs uppercase tracking-wide text-black/42">
                      {event.event_at
                        ? new Date(event.event_at).toLocaleString("en-IN")
                        : "NA"}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-black/62">
                    {describeTimelineEvent(event)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/42">
                    <span>Actor: {event.actor_label || "NA"}</span>
                    {event.from_label ? (
                      <span>From: {event.from_label}</span>
                    ) : null}
                    {event.to_label ? <span>To: {event.to_label}</span> : null}
                  </div>
                  {event.remarks ? (
                    <p className="mt-2 text-xs text-black/42">
                      Remarks: {event.remarks}
                    </p>
                  ) : null}
                </div>
              ))}
              {!timeline.length ? (
                <div className={dashedPanelClass}>
                  No timeline events recorded yet.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={() => setPopup({ open: false, type: "info", message: "" })}
      />
    </>
  );
}
