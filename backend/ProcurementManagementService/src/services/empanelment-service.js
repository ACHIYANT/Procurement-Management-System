const { Op } = require("sequelize");
const EmpanelmentRepository = require("../repository/empanelment-repository");
const {
  buildCursorResponse,
  isCursorMode,
  normalizeCursor,
  normalizeLimit,
  normalizeSortBy,
  normalizeSortDirection,
} = require("../utils/procurement-domain");

const EMPANELMENT_SORT_FIELDS = [
  "id",
  "empanelment_no",
  "status",
  "valid_from",
  "valid_upto",
  "current_valid_upto",
];

class EmpanelmentService {
  constructor() {
    this.repository = new EmpanelmentRepository();
  }

  normalizeText(value) {
    const trimmed = String(value || "").trim().replace(/\s+/g, " ");
    return trimmed || undefined;
  }

  normalizeNullableText(value) {
    return this.normalizeText(value) || null;
  }

  normalizeDate(value, label = "Date") {
    if (!value) {
      const error = new Error(`${label} is required.`);
      error.statusCode = 400;
      throw error;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      const error = new Error(`${label} is invalid.`);
      error.statusCode = 400;
      throw error;
    }

    return String(value).slice(0, 10);
  }

  normalizeNullableDate(value) {
    if (!value) return null;
    return this.normalizeDate(value, "Date");
  }

  asId(value, label) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      const error = new Error(`${label} must be a valid id.`);
      error.statusCode = 400;
      throw error;
    }
    return id;
  }

  normalizeCategories(items = []) {
    return (Array.isArray(items) ? items : [])
      .map((item) => ({
        category_name: this.normalizeText(item?.category_name),
        remarks: this.normalizeNullableText(item?.remarks),
        oems: (Array.isArray(item?.oems) ? item.oems : [])
          .map((oem) => ({
            oem_name: this.normalizeText(oem?.oem_name),
            remarks: this.normalizeNullableText(oem?.remarks),
          }))
          .filter((oem) => oem.oem_name),
      }))
      .filter((item) => item.category_name);
  }

  decorateEmpanelment(empanelment) {
    if (!empanelment) return empanelment;

    const target = empanelment.dataValues || empanelment;
    const categories = Array.isArray(empanelment.item_categories) ? empanelment.item_categories : [];
    const extensions = Array.isArray(empanelment.extensions) ? empanelment.extensions : [];
    const oemCount = categories.reduce((count, category) => count + (category?.oems?.length || 0), 0);
    const currentValidUpto = String(target.current_valid_upto || empanelment.current_valid_upto || "");
    const today = new Date().toISOString().slice(0, 10);

    target.category_count = categories.length;
    target.oem_count = oemCount;
    target.extension_count = extensions.length;
    target.category_labels = categories.map((category) => category.category_name).filter(Boolean);
    target.effective_status =
      currentValidUpto && currentValidUpto < today && String(target.status || empanelment.status || "").toLowerCase() === "active"
        ? "expired"
        : target.status || empanelment.status;

    return empanelment;
  }

  async decorateListRows(rows = []) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return list;

    const empanelmentIds = list.map((row) => row?.id).filter(Boolean);
    const [categories, extensions] = await Promise.all([
      this.repository.findCategoriesByEmpanelmentIds(empanelmentIds),
      this.repository.findExtensionsByEmpanelmentIds(empanelmentIds),
    ]);

    const categoriesByEmpanelmentId = new Map();
    for (const category of categories) {
      const empanelmentId = Number(category.empanelment_id);
      if (!categoriesByEmpanelmentId.has(empanelmentId)) categoriesByEmpanelmentId.set(empanelmentId, []);
      categoriesByEmpanelmentId.get(empanelmentId).push(category);
    }

    const extensionsByEmpanelmentId = new Map();
    for (const extension of extensions) {
      const empanelmentId = Number(extension.empanelment_id);
      if (!extensionsByEmpanelmentId.has(empanelmentId)) extensionsByEmpanelmentId.set(empanelmentId, []);
      extensionsByEmpanelmentId.get(empanelmentId).push(extension);
    }

    return list.map((row) => {
      const empanelment = typeof row?.toJSON === "function" ? row.toJSON() : { ...row };
      const empanelmentId = Number(empanelment.id);
      empanelment.item_categories = categoriesByEmpanelmentId.get(empanelmentId) || [];
      empanelment.extensions = extensionsByEmpanelmentId.get(empanelmentId) || [];
      return this.decorateEmpanelment(empanelment);
    });
  }

  async list(query = {}) {
    const search = this.normalizeText(query.search);
    const where = search
      ? {
          [Op.or]: [
            { empanelment_no: { [Op.like]: `%${search}%` } },
            { status: { [Op.like]: `%${search}%` } },
            { "$firm.firm_name$": { [Op.like]: `%${search}%` } },
            { "$firm.firm_code$": { [Op.like]: `%${search}%` } },
          ],
        }
      : {};

    const cursorMode = isCursorMode(query);
    const limit = normalizeLimit(query.limit);
    const cursor = normalizeCursor(query.cursor);
    const sortBy = normalizeSortBy(
      query.sortBy || query.sort_by,
      EMPANELMENT_SORT_FIELDS,
      "id",
    );
    const sortDirection = normalizeSortDirection(query.sortDir || query.sort_dir, "DESC");

    if (cursorMode) {
      const rows = await this.repository.listBase({
        where,
        limit: limit + 1,
        cursor,
        sortBy,
        sortDirection,
      });
      const response = buildCursorResponse(rows, limit, { sortBy, sortDirection });
      response.rows = await this.decorateListRows(response.rows);
      return response;
    }

    return this.decorateListRows(
      await this.repository.listBase({ where, limit: 100, sortBy, sortDirection }),
    );
  }

  async getById(id) {
    const empanelment = await this.repository.findByPk(this.asId(id, "Empanelment id"));
    if (!empanelment) {
      const error = new Error("Empanelment not found.");
      error.statusCode = 404;
      throw error;
    }
    return this.decorateEmpanelment(empanelment);
  }

  async create(payload = {}) {
    const firmId = this.asId(payload.firm_id, "Firm");
    const empanelmentNo = this.normalizeText(payload.empanelment_no);
    const validFrom = this.normalizeDate(payload.valid_from, "Valid from");
    const validUpto = this.normalizeDate(payload.valid_upto, "Valid upto");
    const categories = this.normalizeCategories(payload.item_categories);

    if (!empanelmentNo) {
      const error = new Error("Empanelment number is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!categories.length) {
      const error = new Error("At least one item category is required.");
      error.statusCode = 400;
      throw error;
    }

    if (validUpto < validFrom) {
      const error = new Error("Valid upto date must be on or after valid from date.");
      error.statusCode = 400;
      throw error;
    }

    const firm = await this.repository.findFirmByPk(firmId);
    if (!firm) {
      const error = new Error("Firm not found.");
      error.statusCode = 404;
      throw error;
    }

    const empanelment = await this.repository.withTransaction(async (transaction) => {
      const createdEmpanelment = await this.repository.createEmpanelment(
        {
          firm_id: firmId,
          empanelment_no: empanelmentNo,
          valid_from: validFrom,
          valid_upto: validUpto,
          current_valid_upto: validUpto,
          status: this.normalizeText(payload.status) || "active",
          approval_reference: this.normalizeNullableText(payload.approval_reference),
          approval_date: this.normalizeNullableDate(payload.approval_date),
          document_path: this.normalizeNullableText(payload.document_path),
          remarks: this.normalizeNullableText(payload.remarks),
        },
        { transaction },
      );

      for (const category of categories) {
        const createdCategory = await this.repository.createItemCategory(
          {
            empanelment_id: createdEmpanelment.id,
            category_name: category.category_name,
            remarks: category.remarks,
          },
          { transaction },
        );

        if (category.oems.length) {
          await this.repository.bulkCreateOems(
            category.oems.map((oem) => ({
              empanelment_id: createdEmpanelment.id,
              item_category_id: createdCategory.id,
              oem_name: oem.oem_name,
              remarks: oem.remarks,
            })),
            { transaction },
          );
        }
      }

      return createdEmpanelment;
    });

    return this.getById(empanelment.id);
  }

  async createExtension(empanelmentId, payload = {}) {
    const empanelment = await this.repository.findByPk(this.asId(empanelmentId, "Empanelment id"));
    if (!empanelment) {
      const error = new Error("Empanelment not found.");
      error.statusCode = 404;
      throw error;
    }

    const previousValidUpto = String(empanelment.current_valid_upto || empanelment.valid_upto || "");
    const extendedUpto = this.normalizeDate(payload.extended_upto, "Extended upto");

    if (previousValidUpto && extendedUpto <= previousValidUpto) {
      const error = new Error("Extended upto date must be later than the current valid upto date.");
      error.statusCode = 400;
      throw error;
    }

    await this.repository.withTransaction(async (transaction) => {
      await this.repository.createExtension(
        {
          empanelment_id: empanelment.id,
          previous_valid_upto: previousValidUpto,
          extended_upto: extendedUpto,
          approval_reference: this.normalizeNullableText(payload.approval_reference),
          approval_date: this.normalizeNullableDate(payload.approval_date),
          approval_document_path: this.normalizeNullableText(payload.approval_document_path),
          remarks: this.normalizeNullableText(payload.remarks),
        },
        { transaction },
      );

      await this.repository.updateEmpanelment(
        empanelment,
        {
          current_valid_upto: extendedUpto,
          status: "extended",
        },
        { transaction },
      );
    });

    return this.getById(empanelment.id);
  }
}

module.exports = EmpanelmentService;
