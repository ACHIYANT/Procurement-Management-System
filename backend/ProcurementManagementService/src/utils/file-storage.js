"use strict";

require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const IV_LENGTH = 16;
const DEFAULT_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const UPLOADS_ROOT = path.resolve(__dirname, "..", "uploads");

const FILE_SECRET =
  process.env.FILE_ENCRYPTION_SECRET ||
  process.env.FILE_ENCRYPTION_KEY ||
  process.env.JWT_KEY;

if (!FILE_SECRET || String(FILE_SECRET).trim().length < 32) {
  throw new Error(
    "FILE_ENCRYPTION_SECRET (or FILE_ENCRYPTION_KEY) must be configured with at least 32 characters.",
  );
}

const ENCRYPTION_KEY = crypto.scryptSync(FILE_SECRET, "pms-file-encryption", 32);

const MIME_TYPES_BY_EXTENSION = {
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/msword",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain",
]);

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".csv",
  ".doc",
  ".docx",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".txt",
  ".webp",
  ".xls",
  ".xlsx",
]);

const FILE_SCOPE_MAP = {
  "allocation-extensions": "allocation-extensions",
  committee_agenda_document: "committee-agenda-documents",
  committee_attendance_document: "committee-attendance-documents",
  committee_proceedings_document: "committee-proceedings-documents",
  delivery_challans: "delivery-challans",
  department_fund_noting: "department-fund-notings",
  department_payment_noting: "department-payment-notings",
  empanelment_document: "empanelment-documents",
  empanelment_extension_approval: "empanelment-extension-approvals",
  emd_refund_approval: "emd-refund-approvals",
  emd_refund_receiving: "emd-refund-receivings",
  emd_submission_document: "emd-submission-documents",
  indent_admin_approval: "indent-admin-approvals",
  indent_document: "indent-documents",
  indent_supporting_document: "indent-supporting-documents",
  indent_specification_document: "indent-specification-documents",
  inspection_notes: "inspection-notes",
  installation_declarations: "installation-declarations",
  installation_noc: "installation-noc",
  installation_reports: "installation-reports",
  "loa-rc-documents": "loa-rc-documents",
  pbg_document: "pbg-documents",
  pbg_refund_approval: "pbg-refund-approvals",
  pbg_refund_receiving: "pbg-refund-receivings",
  "purchase-orders": "purchase-orders",
  purchase_bills: "purchase-bills",
  sale_bills: "sale-bills",
  seller_invoice_copies: "seller-invoice-copies",
  seller_invoices: "seller-invoices",
  work_task_attachment: "work-task-attachments",
  tender_document: "tender-documents",
  vendor_payment_noting: "vendor-payment-notings",
};

const ensureDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const pickExtension = (originalName) => {
  const ext = String(path.extname(originalName || "") || "").toLowerCase();
  return ext && ext.length <= 10 ? ext : "";
};

const sanitizeBaseName = (originalName) => {
  const ext = pickExtension(originalName);
  const base = String(path.basename(originalName || "", ext) || "")
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || "file";
};

const isAllowedUploadFile = (file) => {
  const mimeType = String(file?.mimetype || "").toLowerCase();
  const extension = pickExtension(file?.originalname);
  return (
    ALLOWED_UPLOAD_MIME_TYPES.has(mimeType) &&
    ALLOWED_UPLOAD_EXTENSIONS.has(extension)
  );
};

const assertAllowedUploadFile = (file) => {
  if (!file) {
    const error = new Error("No file uploaded.");
    error.statusCode = 400;
    throw error;
  }

  if (!isAllowedUploadFile(file)) {
    const error = new Error("Unsupported file type.");
    error.statusCode = 400;
    throw error;
  }
};

const assertValidScope = (scope) => {
  const folderName = FILE_SCOPE_MAP[String(scope || "").trim()];
  if (!folderName) {
    const error = new Error("Unsupported upload scope.");
    error.statusCode = 400;
    throw error;
  }
  return folderName;
};

const encryptBuffer = (buffer) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
};

const decryptBuffer = (encryptedBuffer) => {
  if (!Buffer.isBuffer(encryptedBuffer) || encryptedBuffer.length <= IV_LENGTH) {
    const error = new Error("Invalid encrypted file.");
    error.statusCode = 400;
    throw error;
  }

  const iv = encryptedBuffer.subarray(0, IV_LENGTH);
  const encrypted = encryptedBuffer.subarray(IV_LENGTH);
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
};

const resolveSafeUploadPath = (userPath) => {
  const raw = String(userPath || "").trim();
  if (!raw || raw.includes("\u0000") || path.isAbsolute(raw)) return null;

  const normalized = raw.replace(/^\/+/, "");
  const absolutePath = path.resolve(UPLOADS_ROOT, normalized);
  if (
    absolutePath !== UPLOADS_ROOT &&
    !absolutePath.startsWith(`${UPLOADS_ROOT}${path.sep}`)
  ) {
    return null;
  }
  return absolutePath;
};

const saveEncryptedUpload = ({ file, scope, filenameBase }) => {
  assertAllowedUploadFile(file);

  const folderName = assertValidScope(scope);
  const uploadDir = path.join(UPLOADS_ROOT, folderName);
  ensureDirectory(uploadDir);

  const ext = pickExtension(file.originalname);
  const safeBaseName = sanitizeBaseName(filenameBase || file.originalname);
  const filename = `${Date.now()}_${crypto.randomUUID()}_${safeBaseName}${ext}.enc`;
  const absolutePath = path.join(uploadDir, filename);

  fs.writeFileSync(absolutePath, encryptBuffer(file.buffer));

  return {
    path: `/uploads/${folderName}/${filename}`,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
  };
};

const readStoredEncryptedFile = (storedPath) => {
  const cleanPath = String(storedPath || "").replace(/^\/?uploads\//, "");
  const absolutePath = resolveSafeUploadPath(cleanPath);

  if (!absolutePath) {
    const error = new Error("Invalid file path.");
    error.statusCode = 400;
    throw error;
  }

  if (!absolutePath.endsWith(".enc")) {
    const error = new Error("Unsupported file path.");
    error.statusCode = 400;
    throw error;
  }

  if (!fs.existsSync(absolutePath)) {
    const error = new Error("File not found.");
    error.statusCode = 404;
    throw error;
  }

  const decryptedBuffer = decryptBuffer(fs.readFileSync(absolutePath));
  const originalFileName = path.basename(absolutePath).replace(/\.enc$/i, "");
  const originalExtension = pickExtension(originalFileName);
  const mimeType =
    MIME_TYPES_BY_EXTENSION[originalExtension] || "application/octet-stream";

  return {
    absolutePath,
    decryptedBuffer,
    downloadName: originalFileName,
    mimeType,
  };
};

module.exports = {
  DEFAULT_UPLOAD_MAX_BYTES,
  FILE_SCOPE_MAP,
  MIME_TYPES_BY_EXTENSION,
  assertAllowedUploadFile,
  decryptBuffer,
  ensureDirectory,
  isAllowedUploadFile,
  readStoredEncryptedFile,
  resolveSafeUploadPath,
  saveEncryptedUpload,
};
