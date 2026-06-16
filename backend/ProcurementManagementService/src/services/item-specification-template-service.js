"use strict";

const {
  ItemSpecificationTemplateRepository,
} = require("../repository/item-specification-template-repository");
const {
  asId,
  normalizeNullableText,
  normalizeText,
  notFound,
  requireValue,
} = require("../utils/procurement-domain");

const normalizeBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "active"].includes(normalized)) return true;
  if (["false", "0", "no", "inactive"].includes(normalized)) return false;
  return Boolean(value);
};

const normalizeRole = (role) => String(role || "").trim().toUpperCase();

const normalizeRoles = (roles) =>
  (Array.isArray(roles) ? roles : [])
    .map(normalizeRole)
    .filter(Boolean);

const splitTextList = (value) => {
  if (Array.isArray(value)) return value;
  return String(value || "")
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const uniqueTextList = (value = []) => {
  const seen = new Set();
  return splitTextList(value)
    .map((entry) => normalizeText(entry))
    .filter(Boolean)
    .filter((entry) => {
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const normalizeGroups = (groups = []) =>
  (Array.isArray(groups) ? groups : [])
    .map((group) => ({
      label: normalizeText(group?.label),
      suggestions: uniqueTextList(group?.suggestions),
    }))
    .filter((group) => group.label && group.suggestions.length);

const normalizeRequiredDetails = (details = []) =>
  (Array.isArray(details) ? details : [])
    .map((detail) => ({
      label: normalizeText(detail?.label),
      patterns: uniqueTextList(detail?.patterns),
    }))
    .filter((detail) => detail.label && detail.patterns.length);

const normalizeSortOrder = (value) => {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : 100;
};

class ItemSpecificationTemplateService {
  constructor() {
    this.repository = new ItemSpecificationTemplateRepository();
  }

  assertAdmin(actor = {}) {
    const roles = normalizeRoles(actor.roles);
    if (!roles.includes("ADMIN") && !roles.includes("SUPER_ADMIN")) {
      const error = new Error("Only Admin or Super Admin can manage specification templates.");
      error.statusCode = 403;
      throw error;
    }
  }

  async list(query = {}) {
    const activeOnly = normalizeBoolean(query.activeOnly || query.active_only, false);
    return this.repository.list({ activeOnly });
  }

  normalizePayload(payload = {}, { partial = false } = {}) {
    const update = {};

    if (!partial || "template_name" in payload) {
      update.template_name = requireValue(payload, "template_name", "Template name");
    }
    if (!partial || "item_name" in payload) {
      update.item_name = normalizeNullableText(payload.item_name);
    }
    if (!partial || "keywords" in payload || "keywords_json" in payload) {
      update.keywords_json = uniqueTextList(payload.keywords ?? payload.keywords_json);
      if (!partial && !update.keywords_json.length) {
        const error = new Error("At least one keyword is required.");
        error.statusCode = 400;
        throw error;
      }
    }
    if (!partial || "category_hints" in payload || "category_hints_json" in payload) {
      update.category_hints_json = uniqueTextList(
        payload.category_hints ?? payload.category_hints_json,
      );
    }
    if (!partial || "subcategory_hints" in payload || "subcategory_hints_json" in payload) {
      update.subcategory_hints_json = uniqueTextList(
        payload.subcategory_hints ?? payload.subcategory_hints_json,
      );
    }
    if (!partial || "groups" in payload || "groups_json" in payload) {
      update.groups_json = normalizeGroups(payload.groups ?? payload.groups_json);
      if (!partial && !update.groups_json.length) {
        const error = new Error("At least one suggestion group is required.");
        error.statusCode = 400;
        throw error;
      }
    }
    if (!partial || "required_details" in payload || "required_details_json" in payload) {
      update.required_details_json = normalizeRequiredDetails(
        payload.required_details ?? payload.required_details_json,
      );
    }
    if (!partial || "sort_order" in payload) {
      update.sort_order = normalizeSortOrder(payload.sort_order);
    }
    if (!partial || "is_active" in payload) {
      update.is_active = normalizeBoolean(payload.is_active, true);
    }

    return update;
  }

  async create(payload = {}, actor = {}) {
    this.assertAdmin(actor);
    const normalized = this.normalizePayload(payload);
    const existing = await this.repository.findByName(normalized.template_name);
    if (existing) {
      const error = new Error("This specification template already exists.");
      error.statusCode = 409;
      throw error;
    }
    return this.repository.create(normalized);
  }

  async update(id, payload = {}, actor = {}) {
    this.assertAdmin(actor);
    const template = await this.repository.findByPk(asId(id, "Template id"));
    if (!template) throw notFound("Specification template not found.");

    const normalized = this.normalizePayload(payload, { partial: true });
    if (normalized.template_name && normalized.template_name !== template.template_name) {
      const existing = await this.repository.findByName(normalized.template_name);
      if (existing && String(existing.id) !== String(template.id)) {
        const error = new Error("This specification template already exists.");
        error.statusCode = 409;
        throw error;
      }
    }

    if (Object.keys(normalized).length) {
      await this.repository.update(template, normalized);
    }
    return this.repository.findByPk(template.id);
  }
}

module.exports = ItemSpecificationTemplateService;
