"use strict";

const GovernmentOrganizationRepository = require("../repository/government-organization-repository");
const {
  asId,
  normalizeNullableText,
  normalizeText,
  notFound,
  requireValue,
} = require("../utils/procurement-domain");

const ROOT_ORDER = [
  "Department",
  "Authority",
  "Commission",
  "University",
  "Medical College",
  "Society",
  "Court",
];

const normalizeBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "active"].includes(normalized)) return true;
  if (["false", "0", "no", "inactive"].includes(normalized)) return false;
  return Boolean(value);
};

const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");

const toOrganizationCode = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

const compareByDisplay = (left, right) => {
  const leftIndex = ROOT_ORDER.indexOf(left.organization_group);
  const rightIndex = ROOT_ORDER.indexOf(right.organization_group);
  if (leftIndex !== rightIndex) {
    return (
      (leftIndex === -1 ? 999 : leftIndex) -
      (rightIndex === -1 ? 999 : rightIndex)
    );
  }
  const sortDiff = Number(left.sort_order || 100) - Number(right.sort_order || 100);
  if (sortDiff) return sortDiff;
  return String(left.organization_name || "").localeCompare(
    String(right.organization_name || ""),
  );
};

class GovernmentOrganizationService {
  constructor() {
    this.repository = new GovernmentOrganizationRepository();
  }

  assertAdmin(actorRoles = []) {
    const roles = (Array.isArray(actorRoles) ? actorRoles : [])
      .map(normalizeRole)
      .filter(Boolean);
    if (!roles.includes("ADMIN") && !roles.includes("SUPER_ADMIN")) {
      const error = new Error("Only Admin or Super Admin can manage organizations.");
      error.statusCode = 403;
      throw error;
    }
  }

  serialize(row) {
    const organization = typeof row?.toJSON === "function" ? row.toJSON() : row;
    return {
      id: organization.id,
      label: organization.organization_name,
      value: organization.organization_name,
      rawValue: organization.organization_code,
      organization_name: organization.organization_name,
      organization_code: organization.organization_code,
      organization_group: organization.organization_group,
      group: organization.organization_group,
      parent_code: organization.parent_code || null,
      parent: organization.parent_code || null,
      sort_order: Number(organization.sort_order || 100),
      is_active: Boolean(organization.is_active),
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };
  }

  buildTreeAndOptions(rows = []) {
    const records = (Array.isArray(rows) ? rows : [])
      .map((row) => (typeof row?.toJSON === "function" ? row.toJSON() : row))
      .sort(compareByDisplay);

    const byCode = new Map(records.map((row) => [row.organization_code, row]));
    const childrenByParent = new Map();

    for (const row of records) {
      if (!row.parent_code || !byCode.has(row.parent_code)) continue;
      if (!childrenByParent.has(row.parent_code)) childrenByParent.set(row.parent_code, []);
      childrenByParent.get(row.parent_code).push(row);
    }

    for (const children of childrenByParent.values()) {
      children.sort(compareByDisplay);
    }

    const visited = new Set();
    const options = [];

    const toTreeNode = (row, depth = 0) => {
      visited.add(row.organization_code);
      const base = this.serialize(row);
      const children = (childrenByParent.get(row.organization_code) || [])
        .filter((child) => !visited.has(child.organization_code))
        .map((child) => toTreeNode(child, depth + 1));

      options.push({
        ...base,
        label: `${depth > 0 ? `${"  ".repeat(depth)}- ` : ""}${base.organization_name}`,
        depth,
      });

      return {
        ...base,
        label: base.organization_name,
        depth,
        children,
      };
    };

    const roots = records
      .filter((row) => !row.parent_code || !byCode.has(row.parent_code))
      .sort(compareByDisplay);

    const tree = roots.map((row) => toTreeNode(row, 0));
    for (const row of records) {
      if (!visited.has(row.organization_code)) {
        tree.push(toTreeNode(row, 0));
      }
    }

    return {
      rows: records.map((row) => this.serialize(row)),
      tree,
      options,
    };
  }

  async list(query = {}) {
    const activeOnly = normalizeBoolean(query.activeOnly || query.active_only, false);
    const rows = await this.repository.list({
      activeOnly,
      search: normalizeText(query.search),
    });
    return this.buildTreeAndOptions(rows);
  }

  async buildPayload(payload = {}, { existing = null } = {}) {
    const organizationName =
      "organization_name" in payload || "label" in payload
        ? requireValue(
            { organization_name: payload.organization_name || payload.label },
            "organization_name",
            "Organization name",
          )
        : existing?.organization_name;
    const organizationGroup =
      normalizeText(payload.organization_group || payload.group) ||
      existing?.organization_group ||
      "Department";
    const organizationCode = existing
      ? existing.organization_code
      : toOrganizationCode(payload.organization_code || payload.value || organizationName);

    if (!organizationCode) {
      const error = new Error("Organization code could not be generated.");
      error.statusCode = 400;
      throw error;
    }

    const parentCode = normalizeNullableText(payload.parent_code || payload.parent);
    if (parentCode) {
      if (parentCode === organizationCode) {
        const error = new Error("Parent organization cannot be the same organization.");
        error.statusCode = 400;
        throw error;
      }
      const parent = await this.repository.findByCode(parentCode);
      if (!parent) {
        const error = new Error("Selected parent organization does not exist.");
        error.statusCode = 400;
        throw error;
      }
    }

    const sortOrder =
      payload.sort_order === undefined || payload.sort_order === ""
        ? Number(existing?.sort_order || 100)
        : Number(payload.sort_order);

    if (!Number.isFinite(sortOrder)) {
      const error = new Error("Sort order must be a valid number.");
      error.statusCode = 400;
      throw error;
    }

    return {
      organization_name: organizationName,
      organization_code: organizationCode,
      organization_group: organizationGroup,
      parent_code: parentCode,
      sort_order: sortOrder,
      is_active: normalizeBoolean(payload.is_active, existing?.is_active ?? true),
    };
  }

  async create(payload = {}) {
    this.assertAdmin(payload.actor_roles);
    const normalized = await this.buildPayload(payload);

    const [sameCode, sameName] = await Promise.all([
      this.repository.findByCode(normalized.organization_code),
      this.repository.findByGroupAndName(
        normalized.organization_group,
        normalized.organization_name,
      ),
    ]);

    if (sameCode) {
      const error = new Error("An organization with this code already exists.");
      error.statusCode = 409;
      throw error;
    }
    if (sameName) {
      const error = new Error("This organization already exists under the selected group.");
      error.statusCode = 409;
      throw error;
    }

    const created = await this.repository.create(normalized);
    return this.serialize(created);
  }

  async update(id, payload = {}) {
    this.assertAdmin(payload.actor_roles);
    const organization = await this.repository.findByPk(asId(id, "Organization id"));
    if (!organization) throw notFound("Organization not found.");

    const normalized = await this.buildPayload(payload, { existing: organization });
    const sameName = await this.repository.findByGroupAndName(
      normalized.organization_group,
      normalized.organization_name,
    );
    if (sameName && Number(sameName.id) !== Number(organization.id)) {
      const error = new Error("Another organization with this name already exists under the selected group.");
      error.statusCode = 409;
      throw error;
    }

    const updated = await this.repository.update(organization, normalized);
    return this.serialize(updated);
  }
}

module.exports = GovernmentOrganizationService;
