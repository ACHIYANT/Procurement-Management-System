"use strict";

const { Op } = require("sequelize");

const EMD_SUBMISSION_STATUSES = new Set([
  "not_submitted",
  "submitted",
  "exempted",
  "transferred_to_hartron",
]);

const EMD_EXEMPTION_STATUSES = new Set(["none", "full"]);
const EMD_SUBMISSION_MODES = new Set(["nic_portal", "dd", "cheque", "rtgs", "bg", "cash"]);
const REFUND_STATUSES = new Set(["not_due", "pending", "refunded", "forfeited"]);
const PBG_SUBMISSION_MODES = new Set(["bank_guarantee", "dd", "rtgs", "cash"]);
const PBG_STATUSES = new Set(["active", "extended", "released", "expired", "forfeited"]);
const PBG_REFUND_STATUSES = new Set(["held", "pending", "released", "forfeited"]);

const normalizeText = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim().replace(/\s+/g, " ");
  return trimmed || undefined;
};

const normalizeNullableText = (value) => normalizeText(value) || null;

const normalizeAmount = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    const error = new Error("Amount must be a valid non-negative number.");
    error.statusCode = 400;
    throw error;
  }
  return amount.toFixed(2);
};

const normalizeNullableAmount = (value) => {
  if (value === undefined || value === null || value === "") return null;
  return normalizeAmount(value);
};

const asAmountNumber = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const requireAmount = (payload, field, label = field) => {
  if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
    const error = new Error(`${label} is required.`);
    error.statusCode = 400;
    throw error;
  }
  return normalizeAmount(payload[field]);
};

const normalizeDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error("Date value is invalid.");
    error.statusCode = 400;
    throw error;
  }
  return String(value).slice(0, 10);
};

const normalizeNullableDate = (value) => {
  if (!value) return null;
  return normalizeDate(value);
};

const requireDate = (payload, field, label = field) => {
  if (!payload[field]) {
    const error = new Error(`${label} is required.`);
    error.statusCode = 400;
    throw error;
  }
  return normalizeDate(payload[field]);
};

const requireValue = (payload, field, label = field) => {
  const value = normalizeText(payload[field]);
  if (!value) {
    const error = new Error(`${label} is required.`);
    error.statusCode = 400;
    throw error;
  }
  return value;
};

const assertAllowed = (value, allowed, label) => {
  if (value && !allowed.has(value)) {
    const error = new Error(`${label} is invalid.`);
    error.statusCode = 400;
    throw error;
  }
};

const asId = (value, label) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error(`${label} must be a valid id.`);
    error.statusCode = 400;
    throw error;
  }
  return id;
};

const hasOwn = (payload, field) =>
  Object.prototype.hasOwnProperty.call(payload || {}, field);

const normalizeLimit = (value, fallback = 100, max = 200) => {
  const limit = Number(value || fallback);
  if (!Number.isInteger(limit) || limit <= 0) return fallback;
  return Math.min(limit, max);
};

const encodeCursorToken = (payload) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

const decodeCursorToken = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    return { id: asId(raw, "Cursor"), value: null, legacy: true };
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    return {
      id: asId(decoded?.id, "Cursor"),
      value:
        decoded?.value === undefined || decoded?.value === ""
          ? null
          : decoded.value,
      legacy: false,
    };
  } catch {
    const error = new Error("Cursor is invalid.");
    error.statusCode = 400;
    throw error;
  }
};

const normalizeCursor = (value) => decodeCursorToken(value);

const normalizeSortDirection = (value, fallback = "DESC") => {
  const text = String(value || fallback).trim().toUpperCase();
  return text === "ASC" ? "ASC" : "DESC";
};

const normalizeSortBy = (value, allowed = [], fallback = "id") => {
  const requested = normalizeText(value) || fallback;
  return allowed.includes(requested) ? requested : fallback;
};

const buildSortOrder = (sortBy = "id", sortDirection = "DESC") => {
  const direction = normalizeSortDirection(sortDirection);
  if (sortBy === "id") return [["id", direction]];
  return [
    [sortBy, direction],
    ["id", direction],
  ];
};

const buildCursorWhere = ({ baseWhere = {}, cursor, sortBy = "id", sortDirection = "DESC" }) => {
  if (!cursor?.id) return { ...baseWhere };

  const direction = normalizeSortDirection(sortDirection);
  const operator = direction === "ASC" ? Op.gt : Op.lt;

  if (sortBy === "id" || cursor.legacy) {
    return {
      ...baseWhere,
      id: { [operator]: cursor.id },
    };
  }

  return {
    ...baseWhere,
    [Op.or]: [
      {
        ...baseWhere,
        [sortBy]: { [operator]: cursor.value },
      },
      {
        ...baseWhere,
        [sortBy]: cursor.value,
        id: { [operator]: cursor.id },
      },
    ],
  };
};

const isCursorMode = (query = {}) =>
  String(query.cursorMode || query.cursor_mode || "").toLowerCase() === "true";

const buildCursorResponse = (rows, limit, options = {}) => {
  const sortBy = options.sortBy || "id";
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];
  const sortValue = lastRow?.[sortBy];
  const nextCursor =
    hasMore && lastRow?.id
      ? encodeCursorToken({
          id: lastRow.id,
          value: sortBy === "id" ? null : sortValue ?? null,
        })
      : null;

  return {
    rows: pageRows,
    meta: {
      hasMore,
      nextCursor,
      limit,
      sortBy,
      sortDir: normalizeSortDirection(options.sortDirection || "DESC"),
    },
  };
};

const roundAmount = (value) => Number(asAmountNumber(value).toFixed(2));

const resolveRequiredPbgAmount = (purchaseOrder) => {
  const amount = asAmountNumber(purchaseOrder?.required_pbg_amount);
  if (amount > 0) return roundAmount(amount);

  const percentage = asAmountNumber(purchaseOrder?.required_pbg_percentage);
  const poValue = asAmountNumber(purchaseOrder?.po_value);
  if (percentage > 0 && poValue > 0) {
    return roundAmount((poValue * percentage) / 100);
  }

  return 0;
};

const buildPurchaseOrderPbgSummary = (purchaseOrder) => {
  const entries = Array.isArray(purchaseOrder?.pbg_entries) ? purchaseOrder.pbg_entries : [];
  const obligations = Array.isArray(purchaseOrder?.pbg_obligations)
    ? purchaseOrder.pbg_obligations.filter(
        (row) => String(row?.status || "").toLowerCase() === "active",
      )
    : [];
  const requiredAmount = obligations.length
    ? roundAmount(
        obligations.reduce(
          (sum, obligation) => sum + asAmountNumber(obligation?.required_amount),
          0,
        ),
      )
    : resolveRequiredPbgAmount(purchaseOrder);
  const submittedAmount = obligations.length
    ? roundAmount(
        obligations.reduce((sum, obligation) => {
          const allocated = Array.isArray(obligation?.receipt_allocations)
            ? obligation.receipt_allocations.reduce(
                (innerSum, allocation) =>
                  innerSum + asAmountNumber(allocation?.allocated_amount),
                0,
              )
            : 0;
          return sum + allocated;
        }, 0),
      )
    : roundAmount(
        entries.reduce((sum, entry) => sum + asAmountNumber(entry?.pbg_amount), 0),
      );
  const shortAmount = roundAmount(Math.max(requiredAmount - submittedAmount, 0));
  const activeCount = entries.filter((entry) => entry?.status === "active").length;
  const releasePendingCount = entries.filter((entry) =>
    ["held", "pending"].includes(String(entry?.refund_status || "")),
  ).length;

  return {
    required_amount: requiredAmount,
    submitted_amount: submittedAmount,
    short_amount: shortAmount,
    is_short: shortAmount > 0,
    total_entries: entries.length,
    active_count: activeCount,
    release_pending_count: releasePendingCount,
  };
};

const buildPurchaseOrderPaymentSummary = (purchaseOrder) => {
  const entries = Array.isArray(purchaseOrder?.vendor_payments)
    ? purchaseOrder.vendor_payments
    : [];
  const poValue = asAmountNumber(purchaseOrder?.po_value);
  const paidAmount = roundAmount(
    entries.reduce((sum, entry) => sum + asAmountNumber(entry?.payment_amount), 0),
  );
  const pendingAmount = roundAmount(Math.max(poValue - paidAmount, 0));
  const paidPercentage = poValue > 0 ? roundAmount((paidAmount * 100) / poValue) : 0;

  return {
    total_paid_amount: paidAmount,
    pending_amount: pendingAmount,
    paid_percentage: paidPercentage,
    total_entries: entries.length,
    is_fully_paid: poValue > 0 && pendingAmount === 0,
  };
};

const decoratePurchaseOrder = (purchaseOrder) => {
  if (!purchaseOrder) return purchaseOrder;
  purchaseOrder.dataValues.pbg_summary = buildPurchaseOrderPbgSummary(purchaseOrder);
  purchaseOrder.dataValues.payment_summary = buildPurchaseOrderPaymentSummary(purchaseOrder);
  return purchaseOrder;
};

const notFound = (message) => {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
};

module.exports = {
  EMD_EXEMPTION_STATUSES,
  EMD_SUBMISSION_MODES,
  EMD_SUBMISSION_STATUSES,
  PBG_REFUND_STATUSES,
  PBG_STATUSES,
  PBG_SUBMISSION_MODES,
  REFUND_STATUSES,
  asAmountNumber,
  asId,
  assertAllowed,
  buildCursorWhere,
  buildCursorResponse,
  buildSortOrder,
  buildPurchaseOrderPaymentSummary,
  buildPurchaseOrderPbgSummary,
  normalizeSortBy,
  normalizeSortDirection,
  decoratePurchaseOrder,
  hasOwn,
  isCursorMode,
  normalizeAmount,
  normalizeCursor,
  normalizeDate,
  normalizeLimit,
  normalizeNullableAmount,
  normalizeNullableDate,
  normalizeNullableText,
  normalizeText,
  notFound,
  requireAmount,
  requireDate,
  requireValue,
  resolveRequiredPbgAmount,
  roundAmount,
};
