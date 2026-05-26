import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

import AppLoader from "@/components/AppLoader";
import FileAttachmentField from "@/components/FileAttachmentField";
import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCompactIndianAmount, formatCurrencyINR } from "@/lib/amount-format";
import { postProcurement, procurementRequest, uploadProcurementFile } from "@/lib/procurement-api";
import { getStoredFileName, toProcurementFileDownloadUrl, toProcurementFileViewUrl } from "@/lib/procurement-files";
import { canAccessFeature, getCurrentUserRoles } from "@/lib/roles";

const money = (value) => formatCurrencyINR(value);
const compactMoney = (value) => formatCompactIndianAmount(value);

const label = (value) =>
  String(value || "NA")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const tableHeadClass =
  "bg-[#f5f5f7] text-[11px] uppercase tracking-[0.22em] text-black/42";
const inputClass =
  "h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm";

const downloadXlsxTemplate = async (filename, rows) => {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
  XLSX.writeFile(workbook, filename);
};

const readXlsxRows = async (file) => {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
};

const workflowStageMeta = {
  inspection_delivery: {
    eyebrow: "Inspection & Delivery",
    title: "Inspection and delivery workspace",
    subtitle:
      "Record consignee allocations, inspection, and delivery against PO item quantities.",
  },
  installation: {
    eyebrow: "Installation",
    title: "Installation workspace",
    subtitle:
      "Record normal installation, site-not-ready, plug-and-play, or not-required cases.",
  },
  seller_invoice: {
    eyebrow: "Seller Invoice",
    title: "Vendor bill received",
    subtitle:
      "Record bill details and upload invoice copy received from the firm.",
  },
  purchase_invoice: {
    eyebrow: "Purchase Book/Invoice",
    title: "Accounts purchase booking",
    subtitle:
      "Book purchase invoice with voucher details, TDS, round off, and purchase bill copy.",
  },
  sale_invoice: {
    eyebrow: "Sale Invoice",
    title: "Billing to indenting organization",
    subtitle:
      "Prepare sale bill with consolidated, consignee-wise, or custom billing and consultancy charges.",
  },
  vendor_payment: {
    eyebrow: "Firm/Vendor Payment",
    title: "Payment release workspace",
    subtitle:
      "Record every vendor payment with date, amount, reference, noting copy, and remarks.",
  },
};

export default function PurchaseOrderDetail({ workflowStage = "" }) {
  const { id, poId, tenderId } = useParams();
  const purchaseOrderId = id || poId;
  const location = useLocation();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [roles] = useState(() => getCurrentUserRoles());
  const [purchaseOrder, setPurchaseOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState({ open: false, type: "info", message: "" });
  const [paymentForm, setPaymentForm] = useState({
    payment_stage: "",
    payment_date: new Date().toISOString().slice(0, 10),
    payment_amount: "",
    payment_reference_no: "",
    payment_noting_path: "",
    remarks: "",
  });
  const [consigneeForm, setConsigneeForm] = useState({
    consignee_name: "",
    consignee_address: "",
    contact_no: "",
    remarks: "",
    items: [],
  });
  const [inspectionForm, setInspectionForm] = useState({
    inspection_date: today,
    inspection_note_path: "",
    remarks: "",
    items: [],
  });
  const [deliveryForm, setDeliveryForm] = useState({
    delivery_challan_no: "",
    delivery_challan_date: today,
    seller_invoice_no: "",
    seller_invoice_date: today,
    delivery_document_path: "",
    invoice_document_path: "",
    remarks: "",
    items: [],
  });
  const [installationForm, setInstallationForm] = useState({
    installation_type: "normal",
    report_path: "",
    noc_path: "",
    declaration_path: "",
    remarks: "",
    items: [],
  });
  const [sellerInvoiceForm, setSellerInvoiceForm] = useState({
    seller_invoice_no: "",
    seller_invoice_date: today,
    consignee_id: "",
    bill_from: "",
    ship_to: "",
    invoice_document_path: "",
    remarks: "",
    items: [],
  });
  const [purchaseInvoiceForm, setPurchaseInvoiceForm] = useState({
    seller_invoice_id: "",
    voucher_no: "",
    voucher_date: today,
    tds_amount: "",
    round_off: "",
    remarks: "",
    bill_document_path: "",
  });
  const [saleInvoiceForm, setSaleInvoiceForm] = useState({
    sale_invoice_no: "",
    sale_invoice_date: today,
    billing_mode: "consolidated",
    bill_to: "",
    ship_to: "",
    consultancy_charge_type: "percentage",
    consultancy_percentage: "0",
    consultancy_flat_amount: "",
    round_off: "",
    invoice_document_path: "",
    remarks: "",
    items: [],
  });
	  const [excelPreview, setExcelPreview] = useState({
	    type: "",
	    rows: [],
	    errors: [],
	  });
	  const [excelPreviewQuery, setExcelPreviewQuery] = useState("");
	  const [excelPreviewLimit, setExcelPreviewLimit] = useState(100);
	  const [isExcelPreviewCollapsed, setIsExcelPreviewCollapsed] = useState(false);
	  const [savingPayment, setSavingPayment] = useState(false);
  const [savingWorkflow, setSavingWorkflow] = useState(false);

  const loadPurchaseOrder = useCallback(async () => {
    try {
      setLoading(true);
      setPurchaseOrder(await procurementRequest(`/purchase-orders/${purchaseOrderId}`));
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to fetch PO." });
    } finally {
      setLoading(false);
    }
  }, [purchaseOrderId]);

  useEffect(() => {
    const timer = setTimeout(() => loadPurchaseOrder(), 0);
    return () => clearTimeout(timer);
  }, [loadPurchaseOrder]);

  useEffect(() => {
    const ledger = Array.isArray(purchaseOrder?.quantity_ledger)
      ? purchaseOrder.quantity_ledger
      : [];
    setInspectionForm((current) => ({
      ...current,
      items: ledger.map((row) => ({
        purchase_order_item_id: row.purchase_order_item_id,
        offered_quantity: row.remaining_for_inspection || "",
        accepted_quantity: "",
        remarks: "",
      })),
    }));
    setConsigneeForm((current) => ({
      ...current,
      items: ledger.map((row) => ({
        purchase_order_item_id: row.purchase_order_item_id,
        allocated_quantity: "",
        remarks: "",
      })),
    }));
    setDeliveryForm((current) => ({
      ...current,
      items: ledger.map((row) => ({
        purchase_order_item_id: row.purchase_order_item_id,
        consignee_id: "",
        delivered_quantity: row.remaining_for_delivery || "",
        remarks: "",
      })),
    }));
    setInstallationForm((current) => ({
      ...current,
      items: ledger.map((row) => ({
        purchase_order_item_id: row.purchase_order_item_id,
        consignee_id: "",
        installed_quantity: row.remaining_for_installation || "",
        installation_completion_date: today,
        remarks: "",
      })),
    }));
    setSellerInvoiceForm((current) => ({
      ...current,
      bill_from: current.bill_from || purchaseOrder?.firm?.firm_name || "",
      items: ledger.map((row) => {
        const poItem = (purchaseOrder?.items || []).find(
          (item) => Number(item.id) === Number(row.purchase_order_item_id),
        );
        return {
          purchase_order_item_id: row.purchase_order_item_id,
          consignee_id: "",
          quantity: row.remaining_for_seller_invoice || "",
          unit_rate: poItem?.unit_rate || "",
          gst_percentage: poItem?.gst_percentage || "",
        };
      }),
    }));
    setSaleInvoiceForm((current) => ({
      ...current,
      bill_to:
        current.bill_to ||
        purchaseOrder?.tender?.procurement_case?.indent?.department_name ||
        "",
      items: ledger.map((row) => {
        const poItem = (purchaseOrder?.items || []).find(
          (item) => Number(item.id) === Number(row.purchase_order_item_id),
        );
        return {
          purchase_order_item_id: row.purchase_order_item_id,
          consignee_id: "",
          quantity: row.remaining_for_sale_invoice || "",
          base_unit_rate: poItem?.unit_rate || "",
          gst_percentage: poItem?.gst_percentage || "",
        };
      }),
    }));
  }, [purchaseOrder, today]);

  if (loading && !purchaseOrder) {
    return (
      <div className="grid min-h-full place-items-center bg-slate-100">
        <AppLoader fullScreen message="Loading purchase order..." />
      </div>
    );
  }

  const pbgEntries = purchaseOrder?.pbg_entries || [];
  const poItems = Array.isArray(purchaseOrder?.items) ? purchaseOrder.items : [];
  const consignees = Array.isArray(purchaseOrder?.consignees) ? purchaseOrder.consignees : [];
  const quantityLedger = Array.isArray(purchaseOrder?.quantity_ledger)
    ? purchaseOrder.quantity_ledger
    : [];
  const sellerInvoices = Array.isArray(purchaseOrder?.seller_invoices)
    ? purchaseOrder.seller_invoices
    : [];
  const purchaseInvoices = Array.isArray(purchaseOrder?.purchase_invoices)
    ? purchaseOrder.purchase_invoices
    : [];
  const saleInvoices = Array.isArray(purchaseOrder?.sale_invoices)
    ? purchaseOrder.sale_invoices
    : [];
  const pbgSummary = purchaseOrder?.pbg_summary || {};
  const paymentEntries = purchaseOrder?.vendor_payments || [];
  const paymentSummary = purchaseOrder?.payment_summary || {};
  const activeCount = pbgSummary.active_count || 0;
  const releasePendingCount = pbgSummary.release_pending_count || 0;
  const canManagePbg = canAccessFeature(roles, "purchaseOrders", "managePbg");
  const canManagePayments = canAccessFeature(roles, "purchaseOrders", "managePayments");
  const paymentPendingAmount = Number(paymentSummary.pending_amount || 0);
  const paymentPaidAmount = Number(paymentSummary.total_paid_amount || 0);
  const activeWorkflow = workflowStageMeta[workflowStage] || null;
  const isWorkflowPage = Boolean(activeWorkflow);
  const showInspectionDelivery = workflowStage === "inspection_delivery";
  const showInstallation = workflowStage === "installation";
  const showSellerInvoice = workflowStage === "seller_invoice";
  const showPurchaseInvoice = workflowStage === "purchase_invoice";
  const showSaleInvoice = workflowStage === "sale_invoice";
  const showVendorPayment = workflowStage === "vendor_payment";
  const defaultBackTo = tenderId ? `/tenders/${tenderId}` : "/purchase-orders";
  const backTo = location.state?.returnTo || defaultBackTo;
  const backLabel =
    location.state?.returnLabel ||
    (tenderId ? "Back to tender workflow" : "Back to purchase orders");
  const childReturnState = {
    returnTo: location.pathname,
    returnLabel: activeWorkflow
      ? `Back to ${activeWorkflow.eyebrow}`
      : "Back to purchase order",
    tenderStep: location.state?.tenderStep,
  };
	  const filteredExcelPreviewRows = excelPreview.rows.filter((row) => {
	    const search = excelPreviewQuery.trim().toLowerCase();
	    if (!search) return true;
	    return [
	      row.consignee_name,
	      row.consignee_address,
	      row.item_name,
	      row.quantity,
	      row.allocated_quantity,
	      row.remarks,
	      consignees.find((entry) => Number(entry.id) === Number(row.consignee_id))
	        ?.consignee_name,
	      poItems.find((item) => Number(item.id) === Number(row.purchase_order_item_id))
	        ?.item_name,
	    ]
	      .filter(Boolean)
	      .some((value) => String(value).toLowerCase().includes(search));
	  });

  const uploadPaymentNoting = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadProcurementFile("/files/upload/vendor_payment_noting", formData);
  };

  const uploadWorkflowFile = (folder) => async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadProcurementFile(`/files/upload/${folder}`, formData);
  };

  const updatePaymentForm = (field) => (event) =>
    setPaymentForm((current) => ({ ...current, [field]: event.target.value }));

  const updateNestedItem = (setter, index, field, value) =>
    setter((current) => ({
      ...current,
      items: (current.items || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));

  const addWorkflowRow = (setter) =>
    setter((current) => ({
      ...current,
      items: [
        ...(current.items || []),
        {
          purchase_order_item_id: "",
          consignee_id: "",
          delivered_quantity: "",
          installed_quantity: "",
          installation_completion_date: today,
          quantity: "",
          unit_rate: "",
          base_unit_rate: "",
          gst_percentage: "",
          remarks: "",
        },
      ],
    }));

  const resolvePoItemIdByName = (name) => {
    const normalized = String(name || "").trim().toLowerCase();
    return poItems.find((item) => String(item.item_name || "").trim().toLowerCase() === normalized)?.id || "";
  };

  const resolveConsigneeIdByName = (name) => {
    const normalized = String(name || "").trim().toLowerCase();
    return consignees.find((entry) => String(entry.consignee_name || "").trim().toLowerCase() === normalized)?.id || "";
  };

  const validateConsigneeRows = (rows) => {
    const errors = [];
    const existingKeys = new Set(
      consignees.map(
        (entry) =>
          `${String(entry.consignee_name || "").trim().toLowerCase()}|${String(
            entry.consignee_address || "",
          )
            .trim()
            .toLowerCase()}`,
      ),
    );
    const allocatedByItem = new Map();
    const normalizedRows = rows.map((row, index) => {
      const rowNo = index + 2;
      const consigneeName = String(row["Consignee Name"] || "").trim();
      const consigneeAddress = String(row["Consignee Address"] || "").trim();
      const key = `${consigneeName.toLowerCase()}|${consigneeAddress.toLowerCase()}`;
      if (!consigneeName) {
        errors.push(`Row ${rowNo}: Consignee name is required.`);
      }
      if (!consigneeAddress) {
        errors.push(`Row ${rowNo}: Consignee address is required.`);
      }
      if (consigneeName && consigneeAddress && existingKeys.has(key)) {
        errors.push(`Row ${rowNo}: Consignee name and address already exists in this PO.`);
      }
      const itemId = resolvePoItemIdByName(row["Item Name"]);
      if (row["Item Name"] && !itemId) {
        errors.push(`Row ${rowNo}: Item name does not match PO item list.`);
      }
      const allocatedQuantity = Number(row["Allocated Quantity"] || 0);
      if (itemId && allocatedQuantity > 0) {
        allocatedByItem.set(itemId, (allocatedByItem.get(itemId) || 0) + allocatedQuantity);
      }
      return {
        consignee_name: consigneeName,
        consignee_address: consigneeAddress,
        contact_no: row["Contact No"] || "",
        item_name: row["Item Name"] || "",
        purchase_order_item_id: itemId,
        allocated_quantity: row["Allocated Quantity"] || "",
        remarks: row.Remarks || "",
      };
    });
    allocatedByItem.forEach((allocatedQuantity, itemId) => {
      const poItem = poItems.find((item) => Number(item.id) === Number(itemId));
      const existingAllocated = consignees.reduce(
        (sum, consignee) =>
          sum +
          (consignee.allocated_items || []).reduce(
            (itemSum, item) =>
              Number(item.purchase_order_item_id) === Number(itemId)
                ? itemSum + Number(item.allocated_quantity || 0)
                : itemSum,
            0,
          ),
        0,
      );
      if (allocatedQuantity + existingAllocated > Number(poItem?.quantity || 0)) {
        errors.push(
          `Item ${poItem?.item_name || itemId}: allocated quantity exceeds PO item quantity.`,
        );
      }
    });
    return { rows: normalizedRows, errors };
  };

  const validateMovementRows = (rows, quantityColumn, type) => {
    const errors = [];
    const balanceField =
      type === "delivery" ? "remaining_for_delivery" : "remaining_for_installation";
    const quantityByItem = new Map();
    const normalizedRows = rows.map((row, index) => {
      const rowNo = index + 2;
      const itemId = resolvePoItemIdByName(row["Item Name"]);
      const consigneeId = resolveConsigneeIdByName(row["Consignee Name"]);
      if (!itemId) errors.push(`Row ${rowNo}: Item name does not match PO item list.`);
      if (!consigneeId) errors.push(`Row ${rowNo}: Consignee name does not match consignee list.`);
      const quantity = Number(row[quantityColumn] || 0);
      if (!quantity) errors.push(`Row ${rowNo}: Quantity is required.`);
      if (itemId && quantity > 0) {
        quantityByItem.set(itemId, (quantityByItem.get(itemId) || 0) + quantity);
      }
      return {
        purchase_order_item_id: itemId,
        consignee_id: consigneeId,
        quantity: row[quantityColumn] || "",
        completion_date: row["Installation Completion Date"] || today,
        remarks: row.Remarks || "",
      };
    });
    quantityByItem.forEach((quantity, itemId) => {
      const ledger = quantityLedger.find(
        (row) => Number(row.purchase_order_item_id) === Number(itemId),
      );
      if (quantity > Number(ledger?.[balanceField] || 0)) {
        errors.push(
          `Item ${ledger?.item_name || itemId}: imported quantity exceeds available ${type} balance.`,
        );
      }
    });
    return { type, rows: normalizedRows, errors };
  };

  const importConsigneeExcel = async (file) => {
    if (!file) return;
    try {
	      const rows = await readXlsxRows(file);
	      const preview = validateConsigneeRows(rows);
	      setExcelPreview({ type: "consignee", ...preview });
	      setExcelPreviewQuery("");
	      setExcelPreviewLimit(100);
	      setIsExcelPreviewCollapsed(false);
	    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to validate consignee Excel." });
    }
  };

  const importDeliveryExcel = async (file) => {
    if (!file) return;
	    const rows = await readXlsxRows(file);
	    const preview = validateMovementRows(rows, "Delivered Quantity", "delivery");
	    setExcelPreview(preview);
	    setExcelPreviewQuery("");
	    setExcelPreviewLimit(100);
	    setIsExcelPreviewCollapsed(false);
	  };

  const importInstallationExcel = async (file) => {
    if (!file) return;
	    const rows = await readXlsxRows(file);
	    const preview = validateMovementRows(rows, "Installed Quantity", "installation");
	    setExcelPreview(preview);
	    setExcelPreviewQuery("");
	    setExcelPreviewLimit(100);
	    setIsExcelPreviewCollapsed(false);
	  };

  const confirmExcelPreview = async () => {
    if (excelPreview.errors.length) return;
	    if (excelPreview.type === "consignee") {
	      setSavingWorkflow(true);
	      try {
	        let latest = purchaseOrder;
	        const rowsByConsignee = excelPreview.rows.reduce((map, row) => {
	          const key = `${String(row.consignee_name || "").trim().toLowerCase()}|${String(
	            row.consignee_address || "",
	          )
	            .trim()
	            .toLowerCase()}`;
	          const current = map.get(key) || {
	            consignee_name: row.consignee_name,
	            consignee_address: row.consignee_address,
	            contact_no: row.contact_no,
	            remarks: row.remarks,
	            items: [],
	          };
	          if (row.purchase_order_item_id && Number(row.allocated_quantity || 0) > 0) {
	            current.items.push({
	              purchase_order_item_id: row.purchase_order_item_id,
	              allocated_quantity: row.allocated_quantity,
	              remarks: row.remarks,
	            });
	          }
	          map.set(key, current);
	          return map;
	        }, new Map());
	        for (const row of rowsByConsignee.values()) {
	          latest = await postProcurement(`/purchase-orders/${purchaseOrderId}/consignees`, {
	            consignee_name: row.consignee_name,
	            consignee_address: row.consignee_address,
	            contact_no: row.contact_no,
	            remarks: row.remarks,
	            items: row.items,
	          });
	        }
	        setPurchaseOrder(latest);
	        setExcelPreview({ type: "", rows: [], errors: [] });
	        setExcelPreviewQuery("");
	        setExcelPreviewLimit(100);
	        setPopup({ open: true, type: "success", message: "Consignee Excel imported." });
      } catch (error) {
        setPopup({ open: true, type: "error", message: error.message || "Unable to import consignee Excel." });
      } finally {
        setSavingWorkflow(false);
      }
      return;
    }
    if (excelPreview.type === "delivery") {
      setDeliveryForm((current) => ({
        ...current,
        items: excelPreview.rows.map((row) => ({
          purchase_order_item_id: row.purchase_order_item_id,
          consignee_id: row.consignee_id,
          delivered_quantity: row.quantity,
          remarks: row.remarks,
        })),
      }));
    }
    if (excelPreview.type === "installation") {
      setInstallationForm((current) => ({
        ...current,
        items: excelPreview.rows.map((row) => ({
          purchase_order_item_id: row.purchase_order_item_id,
          consignee_id: row.consignee_id,
          installed_quantity: row.quantity,
          installation_completion_date: row.completion_date,
          remarks: row.remarks,
        })),
      }));
	    }
	    setExcelPreview({ type: "", rows: [], errors: [] });
	    setExcelPreviewQuery("");
	    setExcelPreviewLimit(100);
	  };

  const submitConsignee = async (event) => {
    event.preventDefault();
    setSavingWorkflow(true);
    try {
      const data = await postProcurement(`/purchase-orders/${purchaseOrderId}/consignees`, consigneeForm);
      setPurchaseOrder(data);
      setConsigneeForm((current) => ({
        consignee_name: "",
        consignee_address: "",
        contact_no: "",
        remarks: "",
        items: current.items.map((item) => ({ ...item, allocated_quantity: "", remarks: "" })),
      }));
      setPopup({ open: true, type: "success", message: "Consignee saved." });
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to save consignee." });
    } finally {
      setSavingWorkflow(false);
    }
  };

  const submitInspection = async (event) => {
    event.preventDefault();
    setSavingWorkflow(true);
    try {
      const data = await postProcurement(`/purchase-orders/${purchaseOrderId}/inspections`, inspectionForm);
      setPurchaseOrder(data);
      setPopup({ open: true, type: "success", message: "Inspection saved." });
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to save inspection." });
    } finally {
      setSavingWorkflow(false);
    }
  };

  const submitDelivery = async (event) => {
    event.preventDefault();
    setSavingWorkflow(true);
    try {
      const data = await postProcurement(`/purchase-orders/${purchaseOrderId}/deliveries`, deliveryForm);
      setPurchaseOrder(data);
      setPopup({ open: true, type: "success", message: "Delivery saved." });
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to save delivery." });
    } finally {
      setSavingWorkflow(false);
    }
  };

  const submitInstallation = async (event) => {
    event.preventDefault();
    setSavingWorkflow(true);
    try {
      const data = await postProcurement(`/purchase-orders/${purchaseOrderId}/installations`, installationForm);
      setPurchaseOrder(data);
      setPopup({ open: true, type: "success", message: "Installation saved." });
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to save installation." });
    } finally {
      setSavingWorkflow(false);
    }
  };

  const submitSellerInvoice = async (event) => {
    event.preventDefault();
    setSavingWorkflow(true);
    try {
      const data = await postProcurement(`/purchase-orders/${purchaseOrderId}/seller-invoices`, sellerInvoiceForm);
      setPurchaseOrder(data);
      setPopup({ open: true, type: "success", message: "Seller invoice saved." });
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to save seller invoice." });
    } finally {
      setSavingWorkflow(false);
    }
  };

  const submitPurchaseInvoice = async (event) => {
    event.preventDefault();
    setSavingWorkflow(true);
    try {
      const data = await postProcurement(`/purchase-orders/${purchaseOrderId}/purchase-invoices`, purchaseInvoiceForm);
      setPurchaseOrder(data);
      setPopup({ open: true, type: "success", message: "Purchase invoice booked." });
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to book purchase invoice." });
    } finally {
      setSavingWorkflow(false);
    }
  };

  const submitSaleInvoice = async (event) => {
    event.preventDefault();
    setSavingWorkflow(true);
    try {
      const data = await postProcurement(`/purchase-orders/${purchaseOrderId}/sale-invoices`, saleInvoiceForm);
      setPurchaseOrder(data);
      setPopup({ open: true, type: "success", message: "Sale invoice saved." });
    } catch (error) {
      setPopup({ open: true, type: "error", message: error.message || "Unable to save sale invoice." });
    } finally {
      setSavingWorkflow(false);
    }
  };

  const submitVendorPayment = async (event) => {
    event.preventDefault();
    if (!String(paymentForm.payment_stage || "").trim()) {
      setPopup({ open: true, type: "error", message: "Payment stage is required." });
      return;
    }
    if (!String(paymentForm.payment_amount || "").trim()) {
      setPopup({ open: true, type: "error", message: "Payment amount is required." });
      return;
    }

    try {
      setSavingPayment(true);
      await postProcurement(`/purchase-orders/${purchaseOrderId}/payments`, paymentForm);
      setPaymentForm({
        payment_stage: "",
        payment_date: today,
        payment_amount: "",
        payment_reference_no: "",
        payment_noting_path: "",
        remarks: "",
      });
      await loadPurchaseOrder();
      setPopup({ open: true, type: "success", message: "Vendor payment recorded successfully." });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error.message || "Unable to record vendor payment.",
      });
    } finally {
      setSavingPayment(false);
    }
  };

  return (
    <div className="min-h-full bg-transparent px-4 py-7 text-[#1d1d1f]">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="overflow-hidden rounded-[32px] bg-black text-white shadow-[0_28px_60px_-36px_rgba(0,0,0,0.55)]">
          <div className="border-b border-white/10 px-6 py-4 md:px-8">
          <Link
            to={backTo}
            state={{ tenderStep: location.state?.tenderStep }}
            className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          </div>
          <div className="px-6 py-6 md:px-8 md:py-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/58">
            {activeWorkflow?.eyebrow || "Purchase Order"}
          </p>
          <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-white md:text-[2.45rem]">
            {activeWorkflow?.title || purchaseOrder?.po_no}
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/70 md:text-[15px]">
            {activeWorkflow?.subtitle
              ? `${purchaseOrder?.po_no || "PO"} | ${purchaseOrder?.firm?.firm_name || "Firm"} | ${purchaseOrder?.tender?.tender_reference_no || "Tender not linked"}`
              : `${purchaseOrder?.firm?.firm_name} | ${purchaseOrder?.tender?.tender_reference_no || "Tender not linked"}`}
          </p>
          </div>
        </div>

	        {isWorkflowPage ? (
	          <div className="grid gap-3 md:grid-cols-4">
	            {[
	              ["PO No.", purchaseOrder?.po_no || "NA"],
	              ["Firm", purchaseOrder?.firm?.firm_name || "NA"],
	              ["PO Value", compactMoney(purchaseOrder?.po_value)],
	              ["Warranty Start", purchaseOrder?.warranty_start_date || "Pending"],
	            ].map(([title, value]) => (
	              <div
	                key={title}
	                className="rounded-[22px] bg-white px-4 py-3 shadow-[0_16px_38px_-32px_rgba(0,0,0,0.55)] ring-1 ring-black/8"
	              >
	                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/38">
	                  {title}
	                </p>
	                <p className="mt-1 truncate text-lg font-semibold tracking-[-0.03em] text-[#1d1d1f]">
	                  {value}
	                </p>
	              </div>
	            ))}
	          </div>
        ) : (
        <>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
            <CardContent>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/42">PO Value</p>
              <p className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em]" title={money(purchaseOrder?.po_value)}>{compactMoney(purchaseOrder?.po_value)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
            <CardContent>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/42">Required PBG</p>
              <p className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em]" title={money(pbgSummary.required_amount)}>{compactMoney(pbgSummary.required_amount)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
            <CardContent>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/42">Submitted PBG</p>
              <p className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em]" title={money(pbgSummary.submitted_amount)}>{compactMoney(pbgSummary.submitted_amount)}</p>
            </CardContent>
          </Card>
          <Card className={`border-0 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8 ${pbgSummary.short_amount > 0 ? "bg-[#fff6f6]" : "bg-white"}`}>
            <CardContent>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/42">Short PBG</p>
              <p className={`mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] ${pbgSummary.short_amount > 0 ? "text-rose-700" : ""}`} title={money(pbgSummary.short_amount)}>
                {compactMoney(pbgSummary.short_amount)}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
            <CardContent>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/42">Active PBG</p>
              <p className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em]">{activeCount}</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
            <CardContent>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/42">Release Pending</p>
              <p className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em]">{releasePendingCount}</p>
            </CardContent>
          </Card>
        </div>

        {pbgSummary.short_amount > 0 ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            Alert: this PO still has short PBG of {money(pbgSummary.short_amount)} against the required amount.
          </div>
        ) : null}

        </>
        )}

        {excelPreview.type ? (
          <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/42">
                    Excel Import Preview
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                    {label(excelPreview.type)} rows ready for review
                  </h2>
                  <p className="text-sm text-black/56">
                    Validate first, review the rows, then confirm. Nothing is saved
                    directly on upload.
                  </p>
                </div>
	                <div className="flex flex-wrap gap-2">
	                  <Button
	                    type="button"
	                    variant="outline"
	                    className="rounded-full"
	                    onClick={() =>
	                      setIsExcelPreviewCollapsed((current) => !current)
	                    }
	                  >
	                    {isExcelPreviewCollapsed ? "Show Rows" : "Collapse Rows"}
	                  </Button>
	                  <Button
	                    type="button"
	                    variant="outline"
	                    className="rounded-full"
	                    onClick={() => {
	                      setExcelPreview({ type: "", rows: [], errors: [] });
	                      setExcelPreviewQuery("");
	                      setExcelPreviewLimit(100);
	                    }}
	                  >
	                    Clear
	                  </Button>
                  <Button
                    type="button"
                    className="rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]"
                    disabled={savingWorkflow || Boolean(excelPreview.errors.length)}
                    onClick={confirmExcelPreview}
                  >
                    {savingWorkflow ? "Saving..." : "Confirm Import"}
                  </Button>
                </div>
              </div>

              {excelPreview.errors.length ? (
                <div className="max-h-48 overflow-auto rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {excelPreview.errors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              ) : (
                <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {excelPreview.rows.length} rows validated successfully. Confirm to
                  save/apply these rows.
                </div>
              )}

	              {!isExcelPreviewCollapsed ? (
	                <>
	                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
	                    <input
	                      className={`${inputClass} md:max-w-sm`}
	                      value={excelPreviewQuery}
	                      onChange={(event) => {
	                        setExcelPreviewQuery(event.target.value);
	                        setExcelPreviewLimit(100);
	                      }}
	                      placeholder="Search preview rows..."
	                    />
	                    <p className="text-xs font-medium text-black/48">
	                      Showing {Math.min(filteredExcelPreviewRows.length, excelPreviewLimit)} of{" "}
	                      {filteredExcelPreviewRows.length} matching rows
	                    </p>
	                  </div>
	                  <div className="max-h-80 overflow-auto rounded-[18px] border border-black/8">
	                    <table className="min-w-[900px] text-left text-sm">
	                      <thead className={tableHeadClass}>
	                        <tr>
	                          <th className="px-3 py-2">S. No.</th>
	                          <th className="px-3 py-2">Consignee</th>
	                          <th className="px-3 py-2">Address</th>
	                          <th className="px-3 py-2">Item</th>
	                          <th className="px-3 py-2">Quantity</th>
	                          <th className="px-3 py-2">Remarks</th>
	                        </tr>
	                      </thead>
	                      <tbody className="divide-y divide-black/6">
	                        {filteredExcelPreviewRows
	                          .slice(0, excelPreviewLimit)
	                          .map((row, index) => (
	                            <tr key={`${excelPreview.type}-${index}`} className="bg-white">
	                              <td className="px-3 py-2">{index + 1}</td>
	                              <td className="px-3 py-2">
	                                {row.consignee_name ||
	                                  consignees.find(
	                                    (entry) =>
	                                      Number(entry.id) === Number(row.consignee_id),
	                                  )?.consignee_name ||
	                                  "NA"}
	                              </td>
	                              <td className="px-3 py-2">
	                                {row.consignee_address || "NA"}
	                              </td>
	                              <td className="px-3 py-2">
	                                {row.item_name ||
	                                  poItems.find(
	                                    (item) =>
	                                      Number(item.id) ===
	                                      Number(row.purchase_order_item_id),
	                                  )?.item_name ||
	                                  "NA"}
	                              </td>
	                              <td className="px-3 py-2">
	                                {row.allocated_quantity || row.quantity || "NA"}
	                              </td>
	                              <td className="px-3 py-2">{row.remarks || "NA"}</td>
	                            </tr>
	                          ))}
	                      </tbody>
	                    </table>
	                  </div>
	                  {filteredExcelPreviewRows.length > excelPreviewLimit ? (
	                    <Button
	                      type="button"
	                      variant="outline"
	                      className="rounded-full"
	                      onClick={() => setExcelPreviewLimit((current) => current + 100)}
	                    >
	                      Load Next 100 Rows
	                    </Button>
	                  ) : null}
	                </>
	              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
          <CardContent className="space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/42">
                PO Fulfilment
              </p>
              <h2 className="mt-1 text-[1.5rem] font-semibold tracking-[-0.035em] text-[#1d1d1f]">
                Item-wise quantity movement
              </h2>
              <p className="mt-1 text-sm leading-6 text-black/56">
                The system validates inspection, delivery, and installation
                against the PO item quantities so downstream entries cannot
                exceed the approved quantity.
              </p>
            </div>

            <div className="overflow-x-auto rounded-[22px] border border-black/8">
              <table className="min-w-[1420px] text-left text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Make / Model</th>
                    <th className="px-4 py-3">PO Qty</th>
                    <th className="px-4 py-3">Offered</th>
                    <th className="px-4 py-3">Accepted</th>
                    <th className="px-4 py-3">Delivered</th>
                    <th className="px-4 py-3">Installed</th>
                    <th className="px-4 py-3">Seller Invoiced</th>
                    <th className="px-4 py-3">Purchase Booked</th>
                    <th className="px-4 py-3">Sale Invoiced</th>
                    <th className="px-4 py-3">Delivery Balance</th>
                    <th className="px-4 py-3">Seller Balance</th>
                    <th className="px-4 py-3">Sale Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6">
                  {quantityLedger.map((row) => (
                    <tr key={row.purchase_order_item_id} className="bg-white">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#1d1d1f]">{row.item_name}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-black/50">
                          {row.item_description || "No description"}
                        </p>
                      </td>
                      <td className="px-4 py-3">{[row.make, row.model].filter(Boolean).join(" / ") || "NA"}</td>
                      <td className="px-4 py-3">{row.po_quantity}</td>
                      <td className="px-4 py-3">{row.offered_quantity}</td>
                      <td className="px-4 py-3">{row.accepted_quantity}</td>
                      <td className="px-4 py-3">{row.delivered_quantity}</td>
                      <td className="px-4 py-3">{row.installed_quantity}</td>
                      <td className="px-4 py-3">{row.seller_invoiced_quantity}</td>
                      <td className="px-4 py-3">{row.purchase_booked_quantity}</td>
                      <td className="px-4 py-3">{row.sale_invoiced_quantity}</td>
                      <td className="px-4 py-3">{row.remaining_for_delivery}</td>
                      <td className="px-4 py-3">{row.remaining_for_seller_invoice}</td>
                      <td className="px-4 py-3">{row.remaining_for_sale_invoice}</td>
                    </tr>
                  ))}
                  {!quantityLedger.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-black/52" colSpan={13}>
                        No item-wise PO data is available yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {!isWorkflowPage || showInspectionDelivery ? (
        <div
          className={`grid gap-5 ${
            !isWorkflowPage && showInspectionDelivery ? "xl:grid-cols-2" : ""
          }`}
        >
          {!isWorkflowPage ? (
          <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
            <CardContent className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.03em]">Consignee List</h2>
                <p className="text-sm text-black/56">
                  Add delivery locations once, then reuse them in delivery and
                  installation entries.
                </p>
              </div>
              <form className="grid gap-3" onSubmit={submitConsignee}>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() =>
                      downloadXlsxTemplate("po-consignee-template.xlsx", [
                        {
                          "Consignee Name": "Civil Surgeon Panchkula",
                          "Consignee Address": "Panchkula",
                          "Contact No": "9999999999",
                          "Item Name": poItems[0]?.item_name || "Laptop",
                          "Allocated Quantity": 10,
                          Remarks: "",
                        },
                      ])
                    }
                  >
                    Download Excel Template
                  </Button>
                  <label className="inline-flex h-10 cursor-pointer items-center rounded-full border border-black/10 bg-white px-4 text-sm font-medium">
                    Import Excel
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(event) => importConsigneeExcel(event.target.files?.[0])}
                    />
                  </label>
                </div>
                <input
                  className={inputClass}
                  value={consigneeForm.consignee_name}
                  onChange={(event) =>
                    setConsigneeForm((current) => ({ ...current, consignee_name: event.target.value }))
                  }
                  placeholder="Consignee name"
                />
                <textarea
                  className="min-h-20 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  value={consigneeForm.consignee_address}
                  onChange={(event) =>
                    setConsigneeForm((current) => ({ ...current, consignee_address: event.target.value }))
                  }
                  placeholder="Consignee address"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className={inputClass}
                    value={consigneeForm.contact_no}
                    onChange={(event) =>
                      setConsigneeForm((current) => ({ ...current, contact_no: event.target.value }))
                    }
                    placeholder="Contact no."
                  />
                  <input
                    className={inputClass}
                    value={consigneeForm.remarks}
                    onChange={(event) =>
                      setConsigneeForm((current) => ({ ...current, remarks: event.target.value }))
                    }
                    placeholder="Remarks"
                  />
                </div>
                <div className="overflow-x-auto rounded-[18px] border border-black/8">
                  <table className="min-w-[620px] text-left text-sm">
                    <thead className={tableHeadClass}>
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2">Allocated Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/6">
                      {consigneeForm.items.map((item, index) => {
                        const poItem = poItems.find(
                          (row) => Number(row.id) === Number(item.purchase_order_item_id),
                        );
                        return (
                          <tr key={item.purchase_order_item_id}>
                            <td className="px-3 py-2">{poItem?.item_name || "Item"}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                className={inputClass}
                                value={item.allocated_quantity}
                                onChange={(event) =>
                                  updateNestedItem(
                                    setConsigneeForm,
                                    index,
                                    "allocated_quantity",
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
                <Button className="rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]" disabled={savingWorkflow}>
                  Add Consignee
                </Button>
              </form>
              <div className="max-h-72 overflow-auto rounded-[18px] border border-black/8">
                <table className="min-w-full text-left text-sm">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Contact</th>
                    </tr>
                  </thead>
	                  <tbody className="divide-y divide-black/6">
	                    {consignees.map((entry) => (
	                      <tr key={entry.id}>
	                        <td className="px-3 py-2">
	                          <p className="font-medium">{entry.consignee_name}</p>
	                          <p className="text-xs text-black/50">{entry.consignee_address}</p>
	                          {(entry.allocated_items || []).length ? (
	                            <p className="mt-1 text-xs text-black/45">
	                              {(entry.allocated_items || [])
	                                .map((allocatedItem) => {
	                                  const poItem = poItems.find(
	                                    (item) =>
	                                      Number(item.id) ===
	                                      Number(allocatedItem.purchase_order_item_id),
	                                  );
	                                  return `${poItem?.item_name || "Item"}: ${
	                                    allocatedItem.allocated_quantity
	                                  }`;
	                                })
	                                .join(" | ")}
	                            </p>
	                          ) : null}
	                        </td>
	                        <td className="px-3 py-2">{entry.contact_no || "NA"}</td>
	                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          ) : null}

          {showInspectionDelivery ? (
          <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
            <CardContent className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.03em]">Inspection</h2>
                <p className="text-sm text-black/56">
                  Offered and accepted quantities are checked against remaining
                  PO quantity.
                </p>
              </div>
              <form className="space-y-3" onSubmit={submitInspection}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="date"
                    className={inputClass}
                    value={inspectionForm.inspection_date}
                    onChange={(event) =>
                      setInspectionForm((current) => ({ ...current, inspection_date: event.target.value }))
                    }
                  />
                  <input
                    className={inputClass}
                    value={inspectionForm.remarks}
                    onChange={(event) =>
                      setInspectionForm((current) => ({ ...current, remarks: event.target.value }))
                    }
                    placeholder="Remarks"
                  />
                </div>
                <FileAttachmentField
                  label="Inspection Note"
                  storedPath={inspectionForm.inspection_note_path}
                  onChange={(value) =>
                    setInspectionForm((current) => ({ ...current, inspection_note_path: value }))
                  }
                  onUpload={uploadWorkflowFile("inspection_notes")}
                  helperText="Upload inspection note."
                />
                <div className="overflow-x-auto rounded-[18px] border border-black/8">
                  <table className="min-w-[680px] text-left text-sm">
                    <thead className={tableHeadClass}>
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2">Offered</th>
                        <th className="px-3 py-2">Accepted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/6">
                      {inspectionForm.items.map((item, index) => {
                        const poItem = poItems.find((row) => Number(row.id) === Number(item.purchase_order_item_id));
                        return (
                          <tr key={item.purchase_order_item_id}>
                            <td className="px-3 py-2">{poItem?.item_name || "Item"}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                className={inputClass}
                                value={item.offered_quantity}
                                onChange={(event) =>
                                  updateNestedItem(setInspectionForm, index, "offered_quantity", event.target.value)
                                }
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                className={inputClass}
                                value={item.accepted_quantity}
                                onChange={(event) =>
                                  updateNestedItem(setInspectionForm, index, "accepted_quantity", event.target.value)
                                }
                                disabled={!Number(item.offered_quantity || 0)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Button className="rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]" disabled={savingWorkflow}>
                  Save Inspection
                </Button>
              </form>
            </CardContent>
          </Card>
          ) : null}
        </div>
        ) : null}

        {showInspectionDelivery || showInstallation ? (
        <div className="grid gap-5">
          {showInspectionDelivery ? (
          <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
            <CardContent className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.03em]">Delivery</h2>
                <p className="text-sm text-black/56">
                  Delivery quantity cannot exceed accepted inspection quantity.
                </p>
              </div>
              <form className="space-y-3" onSubmit={submitDelivery}>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() =>
                      downloadXlsxTemplate("po-delivery-template.xlsx", [
                        {
                          "Item Name": poItems[0]?.item_name || "Laptop",
                          "Consignee Name": consignees[0]?.consignee_name || "Civil Surgeon Panchkula",
                          "Delivered Quantity": 10,
                          Remarks: "",
                        },
                      ])
                    }
                  >
                    Download Delivery Template
                  </Button>
                  <label className="inline-flex h-10 cursor-pointer items-center rounded-full border border-black/10 bg-white px-4 text-sm font-medium">
                    Import Delivery Excel
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(event) => importDeliveryExcel(event.target.files?.[0])}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => addWorkflowRow(setDeliveryForm)}
                  >
                    Add Delivery Row
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputClass} value={deliveryForm.delivery_challan_no} onChange={(event) => setDeliveryForm((current) => ({ ...current, delivery_challan_no: event.target.value }))} placeholder="Delivery challan no." />
                  <input type="date" className={inputClass} value={deliveryForm.delivery_challan_date} onChange={(event) => setDeliveryForm((current) => ({ ...current, delivery_challan_date: event.target.value }))} />
                  <input className={inputClass} value={deliveryForm.seller_invoice_no} onChange={(event) => setDeliveryForm((current) => ({ ...current, seller_invoice_no: event.target.value }))} placeholder="Seller invoice no." />
                  <input type="date" className={inputClass} value={deliveryForm.seller_invoice_date} onChange={(event) => setDeliveryForm((current) => ({ ...current, seller_invoice_date: event.target.value }))} />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <FileAttachmentField label="Delivery Challan Copy" storedPath={deliveryForm.delivery_document_path} onChange={(value) => setDeliveryForm((current) => ({ ...current, delivery_document_path: value }))} onUpload={uploadWorkflowFile("delivery_challans")} />
                  <FileAttachmentField label="Seller Invoice Copy" storedPath={deliveryForm.invoice_document_path} onChange={(value) => setDeliveryForm((current) => ({ ...current, invoice_document_path: value }))} onUpload={uploadWorkflowFile("seller_invoices")} />
                </div>
                <div className="overflow-x-auto rounded-[18px] border border-black/8">
                  <table className="min-w-[850px] text-left text-sm">
                    <thead className={tableHeadClass}>
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2">Consignee</th>
                        <th className="px-3 py-2">Delivered Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/6">
                      {deliveryForm.items.map((item, index) => {
                        const poItem = poItems.find((row) => Number(row.id) === Number(item.purchase_order_item_id));
                        return (
                          <tr key={`${item.purchase_order_item_id}-${index}`}>
                            <td className="px-3 py-2">
                              <select className={inputClass} value={item.purchase_order_item_id} onChange={(event) => updateNestedItem(setDeliveryForm, index, "purchase_order_item_id", event.target.value)}>
                                <option value="">Select item</option>
                                {poItems.map((entry) => (
                                  <option key={entry.id} value={entry.id}>{entry.item_name}</option>
                                ))}
                              </select>
                              {poItem?.item_description ? (
                                <p className="mt-1 line-clamp-1 text-xs text-black/45">{poItem.item_description}</p>
                              ) : null}
                            </td>
                            <td className="px-3 py-2">
                              <select className={inputClass} value={item.consignee_id} onChange={(event) => updateNestedItem(setDeliveryForm, index, "consignee_id", event.target.value)}>
                                <option value="">Select consignee</option>
                                {consignees.map((entry) => (
                                  <option key={entry.id} value={entry.id}>{entry.consignee_name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" min="0" className={inputClass} value={item.delivered_quantity} onChange={(event) => updateNestedItem(setDeliveryForm, index, "delivered_quantity", event.target.value)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Button className="rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]" disabled={savingWorkflow || !consignees.length}>
                  Save Delivery
                </Button>
              </form>
            </CardContent>
          </Card>
          ) : null}

          {showInstallation ? (
          <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
            <CardContent className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.03em]">Installation</h2>
                <p className="text-sm text-black/56">
                  Installation can be normal, site-not-ready, plug-and-play, or
                  not required, and is checked against delivered quantity.
                </p>
              </div>
              <form className="space-y-3" onSubmit={submitInstallation}>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() =>
                      downloadXlsxTemplate("po-installation-template.xlsx", [
                        {
                          "Item Name": poItems[0]?.item_name || "Laptop",
                          "Consignee Name": consignees[0]?.consignee_name || "Civil Surgeon Panchkula",
                          "Installed Quantity": 10,
                          "Installation Completion Date": today,
                          Remarks: "",
                        },
                      ])
                    }
                  >
                    Download Installation Template
                  </Button>
                  <label className="inline-flex h-10 cursor-pointer items-center rounded-full border border-black/10 bg-white px-4 text-sm font-medium">
                    Import Installation Excel
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(event) => importInstallationExcel(event.target.files?.[0])}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => addWorkflowRow(setInstallationForm)}
                  >
                    Add Installation Row
                  </Button>
                </div>
	                <select className={inputClass} value={installationForm.installation_type} onChange={(event) => setInstallationForm((current) => ({ ...current, installation_type: event.target.value }))}>
	                  <option value="normal">Normal installation</option>
	                  <option value="site_not_ready">Site not ready</option>
	                  <option value="plug_and_play">Plug and play</option>
	                  <option value="not_required">Installation not required</option>
	                </select>
	                <div className="rounded-[18px] bg-[#f5f5f7] px-4 py-3 text-sm leading-6 text-black/58 ring-1 ring-black/6">
	                  {installationForm.installation_type === "site_not_ready"
	                    ? "Site not ready: enter the considered installation date for payment/warranty purpose and upload department NOC if available."
	                    : installationForm.installation_type === "plug_and_play"
	                      ? "Plug and play: upload firm declaration and record the completion/considered date against delivered quantity."
	                      : installationForm.installation_type === "not_required"
	                        ? "Installation not required: record the accepted completion/considered date for warranty tracking."
	                        : "Normal installation: enter actual installation completion date, because this date drives warranty and billing control."}
	                </div>
                <div className="grid gap-3 xl:grid-cols-3">
                  <FileAttachmentField label="Installation Report" storedPath={installationForm.report_path} onChange={(value) => setInstallationForm((current) => ({ ...current, report_path: value }))} onUpload={uploadWorkflowFile("installation_reports")} />
                  <FileAttachmentField label="NOC" storedPath={installationForm.noc_path} onChange={(value) => setInstallationForm((current) => ({ ...current, noc_path: value }))} onUpload={uploadWorkflowFile("installation_noc")} />
                  <FileAttachmentField label="Declaration" storedPath={installationForm.declaration_path} onChange={(value) => setInstallationForm((current) => ({ ...current, declaration_path: value }))} onUpload={uploadWorkflowFile("installation_declarations")} />
                </div>
	                <textarea
	                  className="min-h-20 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
	                  value={installationForm.remarks}
	                  onChange={(event) =>
	                    setInstallationForm((current) => ({
	                      ...current,
	                      remarks: event.target.value,
	                    }))
	                  }
	                  placeholder="Installation remarks / site-not-ready reason / plug-and-play note"
	                />
                <div className="overflow-x-auto rounded-[18px] border border-black/8">
                  <table className="min-w-[950px] text-left text-sm">
                    <thead className={tableHeadClass}>
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2">Consignee</th>
                        <th className="px-3 py-2">Installed Qty</th>
                        <th className="px-3 py-2">Completion Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/6">
                      {installationForm.items.map((item, index) => {
                        const poItem = poItems.find((row) => Number(row.id) === Number(item.purchase_order_item_id));
                        return (
                          <tr key={`${item.purchase_order_item_id}-${index}`}>
                            <td className="px-3 py-2">
                              <select className={inputClass} value={item.purchase_order_item_id} onChange={(event) => updateNestedItem(setInstallationForm, index, "purchase_order_item_id", event.target.value)}>
                                <option value="">Select item</option>
                                {poItems.map((entry) => (
                                  <option key={entry.id} value={entry.id}>{entry.item_name}</option>
                                ))}
                              </select>
                              {poItem?.item_description ? (
                                <p className="mt-1 line-clamp-1 text-xs text-black/45">{poItem.item_description}</p>
                              ) : null}
                            </td>
                            <td className="px-3 py-2">
                              <select className={inputClass} value={item.consignee_id} onChange={(event) => updateNestedItem(setInstallationForm, index, "consignee_id", event.target.value)}>
                                <option value="">Select consignee</option>
                                {consignees.map((entry) => (
                                  <option key={entry.id} value={entry.id}>{entry.consignee_name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" min="0" className={inputClass} value={item.installed_quantity} onChange={(event) => updateNestedItem(setInstallationForm, index, "installed_quantity", event.target.value)} />
                            </td>
                            <td className="px-3 py-2">
                              <input type="date" className={inputClass} value={item.installation_completion_date} onChange={(event) => updateNestedItem(setInstallationForm, index, "installation_completion_date", event.target.value)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Button className="rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]" disabled={savingWorkflow || !consignees.length}>
                  Save Installation
                </Button>
              </form>
            </CardContent>
          </Card>
          ) : null}
        </div>
        ) : null}

        {showSellerInvoice || showPurchaseInvoice ? (
        <div
          className={`grid gap-5 ${
            showSellerInvoice && showPurchaseInvoice ? "xl:grid-cols-3" : ""
          }`}
        >
          {showSellerInvoice ? (
          <Card
            className={`border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8 ${
              showPurchaseInvoice ? "xl:col-span-2" : ""
            }`}
          >
            <CardContent className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/42">
                  Seller Invoice
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                  Bill received from vendor
                </h2>
                <p className="text-sm text-black/56">
                  Quantities are auto-filled from installed/delivered balance
                  and cannot exceed the eligible seller invoice balance.
                </p>
              </div>
              <form className="space-y-3" onSubmit={submitSellerInvoice}>
                <div className="grid gap-3 md:grid-cols-4">
                  <input className={inputClass} value={sellerInvoiceForm.seller_invoice_no} onChange={(event) => setSellerInvoiceForm((current) => ({ ...current, seller_invoice_no: event.target.value }))} placeholder="Seller invoice no." />
                  <input type="date" className={inputClass} value={sellerInvoiceForm.seller_invoice_date} onChange={(event) => setSellerInvoiceForm((current) => ({ ...current, seller_invoice_date: event.target.value }))} />
                  <select className={inputClass} value={sellerInvoiceForm.consignee_id} onChange={(event) => setSellerInvoiceForm((current) => ({ ...current, consignee_id: event.target.value }))}>
                    <option value="">Consolidated / no consignee</option>
                    {consignees.map((entry) => (
                      <option key={entry.id} value={entry.id}>{entry.consignee_name}</option>
                    ))}
                  </select>
                  <input className={inputClass} value={sellerInvoiceForm.ship_to} onChange={(event) => setSellerInvoiceForm((current) => ({ ...current, ship_to: event.target.value }))} placeholder="Ship to" />
                </div>
                <FileAttachmentField label="Seller Invoice Copy" storedPath={sellerInvoiceForm.invoice_document_path} onChange={(value) => setSellerInvoiceForm((current) => ({ ...current, invoice_document_path: value }))} onUpload={uploadWorkflowFile("seller_invoice_copies")} />
                <div className="overflow-x-auto rounded-[18px] border border-black/8">
                  <table className="min-w-[850px] text-left text-sm">
                    <thead className={tableHeadClass}>
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2">Qty</th>
                        <th className="px-3 py-2">Unit Rate</th>
                        <th className="px-3 py-2">GST %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/6">
                      {sellerInvoiceForm.items.map((item, index) => {
                        const poItem = poItems.find((row) => Number(row.id) === Number(item.purchase_order_item_id));
                        return (
                          <tr key={item.purchase_order_item_id}>
                            <td className="px-3 py-2">{poItem?.item_name || "Item"}</td>
                            <td className="px-3 py-2"><input type="number" min="0" className={inputClass} value={item.quantity} onChange={(event) => updateNestedItem(setSellerInvoiceForm, index, "quantity", event.target.value)} /></td>
                            <td className="px-3 py-2"><input type="number" min="0" className={inputClass} value={item.unit_rate} onChange={(event) => updateNestedItem(setSellerInvoiceForm, index, "unit_rate", event.target.value)} /></td>
                            <td className="px-3 py-2"><input type="number" min="0" className={inputClass} value={item.gst_percentage} onChange={(event) => updateNestedItem(setSellerInvoiceForm, index, "gst_percentage", event.target.value)} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Button className="rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]" disabled={savingWorkflow}>
                  Save Seller Invoice
                </Button>
              </form>
            </CardContent>
          </Card>
          ) : null}

          {showPurchaseInvoice ? (
          <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/42">
                    Purchase Book / Invoice
                  </p>
                  <h2 className="mt-1 text-[1.55rem] font-semibold tracking-[-0.04em] text-[#1d1d1f]">
                    Accounts booking against seller bill
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-black/56">
                    Select the seller invoice, enter voucher details, upload the
                    purchase bill copy, and the system will keep the booking
                    linked with this PO.
                  </p>
                </div>
                <div className="grid gap-px overflow-hidden rounded-[18px] bg-black/6 ring-1 ring-black/6 sm:grid-cols-2 lg:min-w-[24rem]">
                  <div className="bg-[#f5f5f7] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/40">
                      Seller Bills
                    </p>
                    <p className="mt-1 text-lg font-semibold tracking-[-0.03em]">
                      {sellerInvoices.length}
                    </p>
                  </div>
                  <div className="bg-[#f5f5f7] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/40">
                      Booked
                    </p>
                    <p className="mt-1 text-lg font-semibold tracking-[-0.03em]">
                      {purchaseInvoices.length}
                    </p>
                  </div>
                </div>
              </div>

              {!sellerInvoices.length ? (
                <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  Record at least one seller invoice before booking the purchase
                  invoice in accounts.
                </div>
              ) : null}

              <form className="space-y-4" onSubmit={submitPurchaseInvoice}>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <label className="space-y-1 xl:col-span-2">
                    <span className="text-sm font-medium text-black/62">
                      Seller Invoice
                    </span>
                    <select className={inputClass} value={purchaseInvoiceForm.seller_invoice_id} onChange={(event) => setPurchaseInvoiceForm((current) => ({ ...current, seller_invoice_id: event.target.value }))}>
                      <option value="">Select seller invoice</option>
                      {sellerInvoices.map((invoice) => (
                        <option key={invoice.id} value={invoice.id}>
                          {invoice.seller_invoice_no} - {money(invoice.grand_total)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-black/62">
                      Voucher No.
                    </span>
                    <input className={inputClass} value={purchaseInvoiceForm.voucher_no} onChange={(event) => setPurchaseInvoiceForm((current) => ({ ...current, voucher_no: event.target.value }))} placeholder="Voucher no." />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-black/62">
                      Voucher Date
                    </span>
                    <input type="date" className={inputClass} value={purchaseInvoiceForm.voucher_date} onChange={(event) => setPurchaseInvoiceForm((current) => ({ ...current, voucher_date: event.target.value }))} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-black/62">
                      TDS Amount
                    </span>
                    <input type="number" min="0" className={inputClass} value={purchaseInvoiceForm.tds_amount} onChange={(event) => setPurchaseInvoiceForm((current) => ({ ...current, tds_amount: event.target.value }))} placeholder="TDS amount" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-black/62">
                      Round Off
                    </span>
                    <input type="number" className={inputClass} value={purchaseInvoiceForm.round_off} onChange={(event) => setPurchaseInvoiceForm((current) => ({ ...current, round_off: event.target.value }))} placeholder="Round off" />
                  </label>
                </div>
                <FileAttachmentField
                  label="Purchase Bill Copy"
                  storedPath={purchaseInvoiceForm.bill_document_path}
	                  onChange={(value) =>
	                    setPurchaseInvoiceForm((current) => ({
	                      ...current,
	                      bill_document_path: value,
	                    }))
	                  }
                  onUpload={uploadWorkflowFile("purchase_bills")}
                  helperText="Upload accounts purchase bill / voucher support copy."
                />
                <div className="flex justify-end">
                  <Button className="rounded-full bg-[#0071e3] px-6 text-white hover:bg-[#0066cc]" disabled={savingWorkflow || !sellerInvoices.length}>
                    Book Purchase Invoice
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          ) : null}
        </div>
        ) : null}

        {showSellerInvoice ? (
        <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
          <CardContent className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/42">
                Seller Invoice History
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                Bills already received from vendor
              </h2>
            </div>
            <div className="overflow-x-auto rounded-[18px] border border-black/8">
              <table className="min-w-[900px] text-left text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className="px-3 py-2">Invoice No.</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Consignee</th>
                    <th className="px-3 py-2">Taxable</th>
                    <th className="px-3 py-2">GST</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Copy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6">
                  {sellerInvoices.length ? (
                    sellerInvoices.map((invoice) => (
                      <tr key={invoice.id} className="bg-white">
                        <td className="px-3 py-2 font-medium">{invoice.seller_invoice_no}</td>
                        <td className="px-3 py-2">{invoice.seller_invoice_date || "NA"}</td>
                        <td className="px-3 py-2">{invoice?.consignee?.consignee_name || "Consolidated"}</td>
                        <td className="px-3 py-2">{money(invoice.taxable_amount)}</td>
                        <td className="px-3 py-2">{money(invoice.gst_amount)}</td>
                        <td className="px-3 py-2">{money(invoice.grand_total)}</td>
                        <td className="px-3 py-2">
                          {invoice.invoice_document_path ? (
                            <a
                              href={toProcurementFileViewUrl(invoice.invoice_document_path)}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-[#0071e3]"
                            >
                              View
                            </a>
                          ) : (
                            "NA"
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-3 py-6 text-center text-black/52" colSpan={7}>
                        No seller invoice recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        ) : null}

        {showPurchaseInvoice ? (
        <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
          <CardContent className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/42">
                Purchase Book History
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                Accounts bookings against seller bills
              </h2>
            </div>
            <div className="overflow-x-auto rounded-[18px] border border-black/8">
              <table className="min-w-[900px] text-left text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className="px-3 py-2">Voucher No.</th>
                    <th className="px-3 py-2">Voucher Date</th>
                    <th className="px-3 py-2">Seller Invoice</th>
                    <th className="px-3 py-2">Gross</th>
                    <th className="px-3 py-2">TDS</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Bill Copy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6">
                  {purchaseInvoices.length ? (
                    purchaseInvoices.map((invoice) => (
                      <tr key={invoice.id} className="bg-white">
                        <td className="px-3 py-2 font-medium">{invoice.voucher_no}</td>
                        <td className="px-3 py-2">{invoice.voucher_date || "NA"}</td>
                        <td className="px-3 py-2">{invoice?.seller_invoice?.seller_invoice_no || "NA"}</td>
                        <td className="px-3 py-2">{money(invoice.gross_amount)}</td>
                        <td className="px-3 py-2">{money(invoice.tds_amount)}</td>
                        <td className="px-3 py-2">{money(invoice.grand_total)}</td>
                        <td className="px-3 py-2">
                          {invoice.bill_document_path ? (
                            <a
                              href={toProcurementFileViewUrl(invoice.bill_document_path)}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-[#0071e3]"
                            >
                              View
                            </a>
                          ) : (
                            "NA"
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-3 py-6 text-center text-black/52" colSpan={7}>
                        No purchase booking recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        ) : null}

        {showSaleInvoice ? (
        <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
          <CardContent className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/42">
                Sale Invoice
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                Billing to indenting organization
              </h2>
              <p className="text-sm text-black/56">
                Use consolidated billing or consignee-wise billing. Consultancy
                charges are applied automatically on the base unit rate.
              </p>
            </div>
            <form className="space-y-3" onSubmit={submitSaleInvoice}>
              <div className="grid gap-3 md:grid-cols-4">
                <input className={inputClass} value={saleInvoiceForm.sale_invoice_no} onChange={(event) => setSaleInvoiceForm((current) => ({ ...current, sale_invoice_no: event.target.value }))} placeholder="Sale invoice no." />
                <input type="date" className={inputClass} value={saleInvoiceForm.sale_invoice_date} onChange={(event) => setSaleInvoiceForm((current) => ({ ...current, sale_invoice_date: event.target.value }))} />
                <select className={inputClass} value={saleInvoiceForm.billing_mode} onChange={(event) => setSaleInvoiceForm((current) => ({ ...current, billing_mode: event.target.value }))}>
                  <option value="consolidated">Consolidated</option>
                  <option value="consignee_wise">Consignee-wise</option>
                  <option value="custom">Custom selection</option>
                </select>
                <select className={inputClass} value={saleInvoiceForm.consultancy_charge_type} onChange={(event) => setSaleInvoiceForm((current) => ({ ...current, consultancy_charge_type: event.target.value }))}>
                  <option value="percentage">Consultancy %</option>
                  <option value="flat">Flat consultancy</option>
                </select>
                <input className={inputClass} value={saleInvoiceForm.bill_to} onChange={(event) => setSaleInvoiceForm((current) => ({ ...current, bill_to: event.target.value }))} placeholder="Bill to" />
                <input className={inputClass} value={saleInvoiceForm.ship_to} onChange={(event) => setSaleInvoiceForm((current) => ({ ...current, ship_to: event.target.value }))} placeholder="Ship to" />
	                <input type="number" min="0" className={inputClass} value={saleInvoiceForm.consultancy_percentage} onChange={(event) => setSaleInvoiceForm((current) => ({ ...current, consultancy_percentage: event.target.value }))} placeholder="Consultancy %" />
	                <input type="number" min="0" className={inputClass} value={saleInvoiceForm.consultancy_flat_amount} onChange={(event) => setSaleInvoiceForm((current) => ({ ...current, consultancy_flat_amount: event.target.value }))} placeholder="Flat amount" />
	                <input type="number" className={inputClass} value={saleInvoiceForm.round_off} onChange={(event) => setSaleInvoiceForm((current) => ({ ...current, round_off: event.target.value }))} placeholder="Round off" />
	              </div>
	              <FileAttachmentField
	                label="Generated Sale Bill Copy"
	                storedPath={saleInvoiceForm.invoice_document_path}
	                onChange={(value) =>
	                  setSaleInvoiceForm((current) => ({
	                    ...current,
	                    invoice_document_path: value,
	                  }))
	                }
	                onUpload={uploadWorkflowFile("sale_bills")}
	                helperText="Upload generated sale bill copy from accounts."
	              />
	              <div className="overflow-x-auto rounded-[18px] border border-black/8">
                <table className="min-w-[900px] text-left text-sm">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Consignee</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Base Rate</th>
                      <th className="px-3 py-2">GST %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/6">
                    {saleInvoiceForm.items.map((item, index) => {
                      const poItem = poItems.find((row) => Number(row.id) === Number(item.purchase_order_item_id));
                      return (
                        <tr key={item.purchase_order_item_id}>
                          <td className="px-3 py-2">{poItem?.item_name || "Item"}</td>
                          <td className="px-3 py-2">
                            <select className={inputClass} value={item.consignee_id} onChange={(event) => updateNestedItem(setSaleInvoiceForm, index, "consignee_id", event.target.value)}>
                              <option value="">All / consolidated</option>
                              {consignees.map((entry) => (
                                <option key={entry.id} value={entry.id}>{entry.consignee_name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2"><input type="number" min="0" className={inputClass} value={item.quantity} onChange={(event) => updateNestedItem(setSaleInvoiceForm, index, "quantity", event.target.value)} /></td>
                          <td className="px-3 py-2"><input type="number" min="0" className={inputClass} value={item.base_unit_rate} onChange={(event) => updateNestedItem(setSaleInvoiceForm, index, "base_unit_rate", event.target.value)} /></td>
                          <td className="px-3 py-2"><input type="number" min="0" className={inputClass} value={item.gst_percentage} onChange={(event) => updateNestedItem(setSaleInvoiceForm, index, "gst_percentage", event.target.value)} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Button className="rounded-full bg-[#0071e3] text-white hover:bg-[#0066cc]" disabled={savingWorkflow}>
                Save Sale Invoice
              </Button>
            </form>
          </CardContent>
        </Card>
        ) : null}

        {showSaleInvoice ? (
        <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
          <CardContent className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/42">
                Sale Invoice History
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                Bills generated for indenting organization
              </h2>
            </div>
            <div className="overflow-x-auto rounded-[18px] border border-black/8">
              <table className="min-w-[900px] text-left text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className="px-3 py-2">Invoice No.</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Billing Mode</th>
                    <th className="px-3 py-2">Bill To</th>
                    <th className="px-3 py-2">Taxable</th>
                    <th className="px-3 py-2">GST</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Copy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6">
                  {saleInvoices.length ? (
                    saleInvoices.map((invoice) => (
                      <tr key={invoice.id} className="bg-white">
                        <td className="px-3 py-2 font-medium">{invoice.sale_invoice_no}</td>
                        <td className="px-3 py-2">{invoice.sale_invoice_date || "NA"}</td>
                        <td className="px-3 py-2">{label(invoice.billing_mode)}</td>
                        <td className="px-3 py-2">{invoice.bill_to || "NA"}</td>
                        <td className="px-3 py-2">{money(invoice.taxable_amount)}</td>
                        <td className="px-3 py-2">{money(invoice.gst_amount)}</td>
                        <td className="px-3 py-2">{money(invoice.grand_total)}</td>
                        <td className="px-3 py-2">
                          {invoice.invoice_document_path ? (
                            <a
                              href={toProcurementFileViewUrl(invoice.invoice_document_path)}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-[#0071e3]"
                            >
                              View
                            </a>
                          ) : (
                            "NA"
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-3 py-6 text-center text-black/52" colSpan={8}>
                        No sale invoice recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        ) : null}

        {showVendorPayment ? (
        <Card className="border-0 bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/42">
                  Firm/Vendor Payment
                </p>
                <h2 className="mt-1 text-[1.4rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]">Payment release and history</h2>
                <p className="text-sm text-black/56">
                  Record every payment made to the vendor after PO release. Partial, leftover, and final payments can all be tracked here.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[20px] bg-[#f5f5f7] p-4 ring-1 ring-black/6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/42">
                  PO Value
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                  {compactMoney(purchaseOrder?.po_value)}
                </p>
              </div>
              <div className="rounded-[20px] bg-[#f5f5f7] p-4 ring-1 ring-black/6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/42">
                  Paid to Vendor
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                  {compactMoney(paymentPaidAmount)}
                </p>
              </div>
              <div className={`rounded-[20px] p-4 ring-1 ring-black/6 ${paymentPendingAmount > 0 ? "bg-[#fffaf2]" : "bg-[#f5f5f7]"}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/42">
                  Pending Payment
                </p>
                <p className={`mt-2 text-2xl font-semibold tracking-[-0.04em] ${paymentPendingAmount > 0 ? "text-amber-700" : ""}`}>
                  {compactMoney(paymentPendingAmount)}
                </p>
              </div>
            </div>

            {paymentPendingAmount > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Payment pending: {money(paymentPendingAmount)} is still pending against this PO.
              </div>
            ) : null}

            {canManagePayments ? (
              <form className="grid gap-4 rounded-[24px] bg-[#f5f5f7] p-4 ring-1 ring-black/6" onSubmit={submitVendorPayment}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Payment Stage</span>
                    <input
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                      value={paymentForm.payment_stage}
                      onChange={updatePaymentForm("payment_stage")}
                      placeholder="1st payment / leftover / final"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Payment Date</span>
                    <input
                      type="date"
                      max={today}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                      value={paymentForm.payment_date}
                      onChange={updatePaymentForm("payment_date")}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Payment Amount</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                      value={paymentForm.payment_amount}
                      onChange={updatePaymentForm("payment_amount")}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Payment Reference No.</span>
                    <input
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                      value={paymentForm.payment_reference_no}
                      onChange={updatePaymentForm("payment_reference_no")}
                      placeholder="Voucher / bill / advice no."
                    />
                  </label>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
                  <FileAttachmentField
                    label="Payment Noting Copy"
                    storedPath={paymentForm.payment_noting_path}
                    onChange={(value) =>
                      setPaymentForm((current) => ({ ...current, payment_noting_path: value }))
                    }
                    onUpload={uploadPaymentNoting}
                    helperText="Upload the noting or payment approval page for this vendor payment."
                  />
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Remarks</span>
                    <textarea
                      className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                      value={paymentForm.remarks}
                      onChange={updatePaymentForm("remarks")}
                      placeholder="Any useful note for this payment entry"
                    />
                  </label>
                </div>

                <div className="flex justify-end">
                  <Button className="bg-cyan-700 text-white hover:bg-cyan-800" disabled={savingPayment}>
                    {savingPayment ? <Loader2 className="animate-spin" /> : "Record Payment"}
                  </Button>
                </div>
              </form>
            ) : null}

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Payment Date</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">PO %</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Noting</th>
                    <th className="px-4 py-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentEntries.length ? (
                    paymentEntries.map((entry) => {
                      const percentage =
                        Number(purchaseOrder?.po_value || 0) > 0
                          ? ((Number(entry.payment_amount || 0) * 100) / Number(purchaseOrder.po_value || 0)).toFixed(2)
                          : "0.00";

                      return (
                        <tr key={entry.id} className="bg-white">
                          <td className="px-4 py-3">{entry.payment_date || "NA"}</td>
                          <td className="px-4 py-3">{entry.payment_stage || "NA"}</td>
                          <td className="px-4 py-3">{money(entry.payment_amount)}</td>
                          <td className="px-4 py-3">{percentage}%</td>
                          <td className="px-4 py-3">{entry.payment_reference_no || "NA"}</td>
                          <td className="px-4 py-3">
                            {entry.payment_noting_path ? (
                              <div className="flex flex-wrap gap-2 text-xs">
                                <a
                                  href={toProcurementFileViewUrl(entry.payment_noting_path)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full border border-slate-200 px-2 py-1 text-cyan-700 hover:bg-cyan-50"
                                >
                                  View
                                </a>
                                <a
                                  href={toProcurementFileDownloadUrl(entry.payment_noting_path)}
                                  className="rounded-full border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50"
                                  title={getStoredFileName(entry.payment_noting_path)}
                                >
                                  Download
                                </a>
                              </div>
                            ) : (
                              "NA"
                            )}
                          </td>
                          <td className="px-4 py-3">{entry.remarks || "NA"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                        No vendor payments recorded yet. Add the first payment after PO release.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
	        </Card>
	        ) : null}

	        {!isWorkflowPage ? (
	        <Card className="border-0 shadow-xl">
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">PBG Records</h2>
                <p className="text-sm text-slate-500">PBGs are automatically linked to this PO and firm.</p>
              </div>
              {canManagePbg ? (
                <Button
                  className="bg-cyan-700 text-white hover:bg-cyan-800"
                  onClick={() =>
                    navigate(`/purchase-orders/${purchaseOrderId}/pbg/new`, {
                      state: childReturnState,
                    })
                  }
                >
                  Add PBG
                </Button>
              ) : null}
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">PBG Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">BG No.</th>
                    <th className="px-4 py-3">Bank</th>
                    <th className="px-4 py-3">Valid Upto</th>
                    <th className="px-4 py-3">Release</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pbgEntries.length ? (
                    pbgEntries.map((entry) => (
                      <tr key={entry.id} className="bg-white">
                        <td className="px-4 py-3">{money(entry.pbg_amount)}</td>
                        <td className="px-4 py-3">{label(entry.status)}</td>
                        <td className="px-4 py-3">{entry.bank_guarantee_no || "NA"}</td>
                        <td className="px-4 py-3">{entry.issuing_bank_name || "NA"}</td>
                        <td className="px-4 py-3">{entry.valid_upto || "NA"}</td>
                        <td className="px-4 py-3">{label(entry.refund_status)}</td>
                        <td className="px-4 py-3">
                          {canManagePbg ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                navigate(`/pbg/${entry.id}/edit`, {
                                  state: childReturnState,
                                })
                              }
                            >
                              Update PBG
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                        No PBG records yet. Use Add PBG when the vendor submits it.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
	        </Card>
	        ) : null}
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
