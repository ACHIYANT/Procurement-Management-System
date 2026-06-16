const normalizeRole = (role) => {
  const normalized = String(role || "")
    .trim()
    .toUpperCase();

  if (normalized === "DEALING_OFFICER") return "PROCUREMENT_OFFICER";
  if (normalized === "PROCUREMENT_ASSISTANT") return "ASSOCIATE";
  return normalized;
};

export const PMS_ROLES = {
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
  PROCUREMENT_OFFICER: "PROCUREMENT_OFFICER",
  INDENT_INITIATOR: "INDENT_INITIATOR",
  ASSOCIATE: "ASSOCIATE",
  FINANCE_OFFICER: "FINANCE_OFFICER",
  APPROVER: "APPROVER",
  VIEWER: "VIEWER",
  USER: "USER",
};

export const PMS_MODULE_ACCESS = {
  workTasks: {
    view: [
      PMS_ROLES.USER,
      PMS_ROLES.VIEWER,
      PMS_ROLES.ASSOCIATE,
      PMS_ROLES.INDENT_INITIATOR,
      PMS_ROLES.PROCUREMENT_OFFICER,
      PMS_ROLES.FINANCE_OFFICER,
      PMS_ROLES.APPROVER,
      PMS_ROLES.ADMIN,
      PMS_ROLES.SUPER_ADMIN,
    ],
    create: [
      PMS_ROLES.USER,
      PMS_ROLES.ASSOCIATE,
      PMS_ROLES.INDENT_INITIATOR,
      PMS_ROLES.PROCUREMENT_OFFICER,
      PMS_ROLES.FINANCE_OFFICER,
      PMS_ROLES.APPROVER,
      PMS_ROLES.ADMIN,
      PMS_ROLES.SUPER_ADMIN,
    ],
    manage: [
      PMS_ROLES.USER,
      PMS_ROLES.ASSOCIATE,
      PMS_ROLES.INDENT_INITIATOR,
      PMS_ROLES.PROCUREMENT_OFFICER,
      PMS_ROLES.FINANCE_OFFICER,
      PMS_ROLES.APPROVER,
      PMS_ROLES.ADMIN,
      PMS_ROLES.SUPER_ADMIN,
    ],
  },
  dashboard: {
    view: [
      PMS_ROLES.USER,
      PMS_ROLES.VIEWER,
      PMS_ROLES.ASSOCIATE,
      PMS_ROLES.INDENT_INITIATOR,
      PMS_ROLES.PROCUREMENT_OFFICER,
      PMS_ROLES.FINANCE_OFFICER,
      PMS_ROLES.APPROVER,
    ],
  },
  indents: {
    view: [PMS_ROLES.ASSOCIATE, PMS_ROLES.INDENT_INITIATOR, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.APPROVER],
    create: [PMS_ROLES.INDENT_INITIATOR],
    manage: [PMS_ROLES.ADMIN, PMS_ROLES.SUPER_ADMIN, PMS_ROLES.INDENT_INITIATOR],
  },
  procurementCases: {
    view: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.APPROVER],
    create: [PMS_ROLES.PROCUREMENT_OFFICER],
  },
  tenders: {
    view: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.APPROVER],
    create: [PMS_ROLES.PROCUREMENT_OFFICER],
    manage: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER],
    officer: [PMS_ROLES.PROCUREMENT_OFFICER],
  },
  purchaseOrders: {
    view: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER],
    create: [PMS_ROLES.PROCUREMENT_OFFICER],
    managePbg: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER],
    managePayments: [PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER],
  },
  emd: {
    view: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER],
    create: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER],
    manage: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER],
  },
  pbg: {
    view: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER],
    create: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER],
    manage: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER],
  },
  departmentFunds: {
    view: [PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER, PMS_ROLES.APPROVER],
    create: [PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER],
  },
  reconciliation: {
    view: [PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER, PMS_ROLES.APPROVER, PMS_ROLES.VIEWER],
  },
  firms: {
    view: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER],
    create: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER],
  },
  empanelments: {
    view: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.APPROVER],
    create: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER],
  },
  itemCategories: {
    view: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.APPROVER],
    create: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER],
  },
  specificationTemplates: {
    view: [PMS_ROLES.ADMIN, PMS_ROLES.SUPER_ADMIN],
    create: [PMS_ROLES.ADMIN, PMS_ROLES.SUPER_ADMIN],
    manage: [PMS_ROLES.ADMIN, PMS_ROLES.SUPER_ADMIN],
  },
  committees: {
    view: [PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.APPROVER],
    create: [PMS_ROLES.PROCUREMENT_OFFICER],
  },
  reports: {
    view: [PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER, PMS_ROLES.APPROVER, PMS_ROLES.VIEWER],
  },
  approvals: {
    view: [PMS_ROLES.ADMIN, PMS_ROLES.SUPER_ADMIN, PMS_ROLES.APPROVER],
    manage: [PMS_ROLES.ADMIN, PMS_ROLES.SUPER_ADMIN],
  },
  administration: {
    view: [PMS_ROLES.ADMIN, PMS_ROLES.SUPER_ADMIN],
    manage: [PMS_ROLES.ADMIN, PMS_ROLES.SUPER_ADMIN],
  },
};

const INDENT_INITIATOR_WORKSPACE_MODULES = new Set([
  "dashboard",
  "workTasks",
  "indents",
]);

export const isIndentInitiatorScopedUser = (currentRoles = []) => {
  const roleSet = new Set(currentRoles.map(normalizeRole).filter(Boolean));
  if (!roleSet.has(PMS_ROLES.INDENT_INITIATOR)) return false;

  const elevatedRoles = [
    PMS_ROLES.ADMIN,
    PMS_ROLES.SUPER_ADMIN,
    PMS_ROLES.ASSOCIATE,
    PMS_ROLES.PROCUREMENT_OFFICER,
    PMS_ROLES.FINANCE_OFFICER,
    PMS_ROLES.APPROVER,
  ];

  return !elevatedRoles.some((role) => roleSet.has(role));
};

export const formatRoleLabel = (role) =>
  normalizeRole(role)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

export const getCurrentUserRoles = () => {
  if (typeof window === "undefined") return [];

  const fromLocalRoles = (() => {
    const raw = localStorage.getItem("roles");
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [raw];
    }
  })();

  if (fromLocalRoles.length) {
    return Array.from(new Set(fromLocalRoles.map(normalizeRole).filter(Boolean)));
  }

  try {
    const me = JSON.parse(localStorage.getItem("me") || "null");
    const raw = Array.isArray(me?.roles)
      ? me.roles
      : me?.roles
        ? [me.roles]
        : [];
    return Array.from(new Set(raw.map(normalizeRole).filter(Boolean)));
  } catch {
    return [];
  }
};

export const getCurrentUserProfile = () => {
  if (typeof window === "undefined") return null;

  try {
    const me = JSON.parse(localStorage.getItem("me") || "null");
    return me && typeof me === "object" ? me : null;
  } catch {
    return null;
  }
};

export const hasAnyRole = (currentRoles = [], allowedRoles = []) => {
  const roleSet = new Set(currentRoles.map(normalizeRole).filter(Boolean));
  return allowedRoles.some((role) => roleSet.has(normalizeRole(role)));
};

export const canAccessModule = (currentRoles = [], allowedRoles = [], { allowAdminOverride = true } = {}) =>
  hasAnyRole(
    currentRoles,
    allowAdminOverride
      ? [PMS_ROLES.SUPER_ADMIN, PMS_ROLES.ADMIN, ...allowedRoles]
      : allowedRoles,
  );

export const canAccessFeature = (
  currentRoles = [],
  moduleKey,
  action = "view",
  options = {},
) => {
  if (
    isIndentInitiatorScopedUser(currentRoles) &&
    !INDENT_INITIATOR_WORKSPACE_MODULES.has(moduleKey)
  ) {
    return false;
  }

  const moduleConfig = PMS_MODULE_ACCESS[moduleKey] || {};
  const allowedRoles = moduleConfig[action] || [];
  return canAccessModule(currentRoles, allowedRoles, options);
};
