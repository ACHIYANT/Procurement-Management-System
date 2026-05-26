const { Op } = require("sequelize");
const { DepartmentFundRepository } = require("../repository/department-fund-repository");
const {
  asId,
  buildCursorResponse,
  isCursorMode,
  normalizeAmount,
  normalizeCursor,
  normalizeDate,
  normalizeLimit,
  normalizeSortBy,
  normalizeSortDirection,
  normalizeNullableText,
  normalizeText,
  requireValue,
} = require("../utils/procurement-domain");

const ENTRY_TYPES = new Set([
  "parked",
  "received",
  "vendor_payment",
  "adjusted",
  "refunded",
  "carry_forward",
]);

const ENTRY_ORIGINS = new Set([
  "department_funds",
  "historical_reconciliation",
  "system_linked",
]);
const DEPARTMENT_FUND_SORT_FIELDS = [
  "id",
  "department_name",
  "subject",
  "entry_type",
  "entry_origin",
  "amount",
  "entry_date",
  "reference_no",
  "financial_year",
];

const assertAllowed = (value, allowed, label) => {
  if (value && !allowed.has(value)) {
    const error = new Error(`${label} is invalid.`);
    error.statusCode = 400;
    throw error;
  }
};

class DepartmentFundService {
  constructor() {
    this.repository = new DepartmentFundRepository();
  }

  async list(query = {}) {
    const where = {};
    const search = normalizeText(query.search);
    const departmentName = normalizeText(query.department_name);
    if (search) {
      where[Op.or] = [
        { department_name: { [Op.like]: `%${search}%` } },
        { subject: { [Op.like]: `%${search}%` } },
        { reference_no: { [Op.like]: `%${search}%` } },
        { estimate_reference: { [Op.like]: `%${search}%` } },
      ];
    }
    if (departmentName) {
      where.department_name = { [Op.like]: departmentName };
    }
    if (query.entry_type) where.entry_type = normalizeText(query.entry_type);
    if (query.entry_origin) where.entry_origin = normalizeText(query.entry_origin);
    const sortBy = normalizeSortBy(
      query.sortBy || query.sort_by,
      DEPARTMENT_FUND_SORT_FIELDS,
      "entry_date",
    );
    const sortDirection = normalizeSortDirection(query.sortDir || query.sort_dir, "DESC");

    if (isCursorMode(query)) {
      const limit = normalizeLimit(query.limit);
      const cursor = normalizeCursor(query.cursor);
      const rows = await this.repository.list({
        where,
        limit: limit + 1,
        cursor,
        sortBy,
        sortDirection,
      });
      return buildCursorResponse(rows, limit, { sortBy, sortDirection });
    }

    return this.repository.list({ where, limit: 200, sortBy, sortDirection });
  }

  async create(payload = {}) {
    const entryType = requireValue(payload, "entry_type", "Entry type");
    const entryOrigin =
      normalizeText(payload.entry_origin) || "department_funds";
    assertAllowed(entryType, ENTRY_TYPES, "Entry type");
    assertAllowed(entryOrigin, ENTRY_ORIGINS, "Entry origin");

    const indentId = payload.indent_id ? asId(payload.indent_id, "Indent") : null;
    const tenderId = payload.tender_id ? asId(payload.tender_id, "Tender") : null;
    const poId = payload.po_id ? asId(payload.po_id, "Purchase order") : null;

    if (indentId) {
      const indent = await this.repository.findIndentByPk(indentId);
      if (!indent) {
        const error = new Error("Linked indent not found.");
        error.statusCode = 404;
        throw error;
      }
    }
    if (tenderId) {
      const tender = await this.repository.findTenderByPk(tenderId);
      if (!tender) {
        const error = new Error("Linked tender not found.");
        error.statusCode = 404;
        throw error;
      }
    }
    if (poId) {
      const purchaseOrder = await this.repository.findPurchaseOrderByPk(poId);
      if (!purchaseOrder) {
        const error = new Error("Linked purchase order not found.");
        error.statusCode = 404;
        throw error;
      }
    }

    if (entryType === "vendor_payment") {
      requireValue(payload, "vendor_name", "Vendor name");
      if (!tenderId) {
        const error = new Error("Tender link is required for vendor payment history.");
        error.statusCode = 400;
        throw error;
      }
    }

    return this.repository.create({
      department_name: requireValue(payload, "department_name", "Department"),
      subject: requireValue(payload, "subject", "Subject"),
      entry_type: entryType,
      entry_origin: entryOrigin,
      amount: normalizeAmount(payload.amount),
      entry_date: normalizeDate(payload.entry_date),
      reference_no: normalizeNullableText(payload.reference_no),
      financial_year: normalizeNullableText(payload.financial_year),
      estimate_reference: normalizeNullableText(payload.estimate_reference),
      estimate_date: payload.estimate_date
        ? normalizeDate(payload.estimate_date)
        : null,
      estimate_amount:
        payload.estimate_amount === "" ||
        payload.estimate_amount === undefined ||
        payload.estimate_amount === null
          ? null
          : normalizeAmount(payload.estimate_amount),
      indent_id: indentId,
      tender_id: tenderId,
      po_id: poId,
      vendor_name: normalizeNullableText(payload.vendor_name),
      noting_page_path: normalizeNullableText(payload.noting_page_path),
      payment_noting_path: normalizeNullableText(payload.payment_noting_path),
      remarks: normalizeNullableText(payload.remarks),
      location_scope: requireValue(
        payload,
        "location_scope",
        "Location scope",
      ),
    });
  }
}

module.exports = DepartmentFundService;
