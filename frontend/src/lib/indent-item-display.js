const SCOPE_LABELS = {
  standard_quantity: "Standard Purchase",
  amc: "AMC",
  camc: "CAMC",
  rate_contract_quantity: "RC - Quantity",
  rate_contract_value: "RC - Value",
  rate_contract_quantity_value: "RC - Quantity + Value",
  rate_contract_time_only: "RC - Validity Only",
  rate_contract_framework: "RC - Framework",
};

const PACKAGE_LIMIT_LABELS = {
  no_fixed_cap: "No fixed package cap",
  value: "Package value cap",
  quantity: "Package quantity cap",
  quantity_value: "Package quantity + value cap",
  validity_only: "Validity only",
};

const LINE_ROLE_LABELS = {
  main_category: "Main category",
  accessory: "Accessory",
  service: "Service",
  optional_add_on: "Optional add-on",
};

const LINE_CAP_LABELS = {
  no_separate_cap: "No separate line cap",
  rate_only: "Rate only",
  quantity: "Line quantity cap",
  value: "Line value cap",
  quantity_value: "Line quantity + value cap",
};

export const getIndentItemScopeLabel = (value) =>
  SCOPE_LABELS[String(value || "standard_quantity")] || "Standard Purchase";

export const isValueRateContractItem = (item = {}) =>
  ["rate_contract_value"].includes(
    item.procurement_scope_type,
  );

export const isFrameworkRateContractItem = (item = {}) =>
  String(item.procurement_scope_type || "") === "rate_contract_framework";

export const requiresIndentQuantity = (item = {}) =>
  [
    "standard_quantity",
    "amc",
    "camc",
    "rate_contract_quantity",
    "rate_contract_quantity_value",
  ].includes(String(item.procurement_scope_type || "standard_quantity"));

export const formatIndentQuantity = (value) => {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) return value || "0";
  return Number.isInteger(numeric) ? String(numeric) : String(numeric);
};

export const formatIndentMoney = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });

export const formatIndentContractPeriod = (item = {}) => {
  if (!item.contract_period_value || !item.contract_period_unit) return "";
  const unit = String(item.contract_period_unit || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
  return `${formatIndentQuantity(item.contract_period_value)} ${unit}`;
};

export const formatIndentContractExtension = (item = {}) => {
  if (!item.contract_extension_allowed) return "";
  const type = String(item.contract_extension_type || "approval_based");
  const value = item.contract_extension_value;
  const unit = item.contract_extension_unit;

  if (type === "approval_based") return "Extension as per approval";
  if (type === "time_period") {
    return value && unit
      ? `Extension up to ${formatIndentQuantity(value)} ${String(unit).replaceAll("_", " ")}`
      : "Time extension allowed";
  }

  const label = {
    quantity_percent: "quantity",
    quantity_fixed: "quantity",
    value_percent: "value",
    value_fixed: "value",
  }[type] || "limit";
  const suffix = type.endsWith("_percent") ? "%" : "";
  return value
    ? `Extension ${label} ${formatIndentQuantity(value)}${suffix}`
    : "Extension allowed";
};

export const getRcPackageLimitLabel = (value) =>
  PACKAGE_LIMIT_LABELS[String(value || "no_fixed_cap")] || "No fixed package cap";

export const getRcLineRoleLabel = (value) =>
  LINE_ROLE_LABELS[String(value || "main_category")] || "Main category";

export const getRcLineCapLabel = (value) =>
  LINE_CAP_LABELS[String(value || "no_separate_cap")] || "No separate line cap";

export const formatRcPackageLimit = (item = {}) => {
  const type = String(item.rc_package_limit_type || "no_fixed_cap");
  if (type === "value") return `Common pool ${formatIndentMoney(item.rc_package_value_limit)}`;
  if (type === "quantity") {
    return `Common pool ${formatIndentQuantity(item.rc_package_quantity_limit)} ${item.unit || ""}`.trim();
  }
  if (type === "quantity_value") {
    const quantity = item.rc_package_quantity_limit
      ? `${formatIndentQuantity(item.rc_package_quantity_limit)} ${item.unit || ""}`.trim()
      : "quantity not entered";
    const value = item.rc_package_value_limit
      ? formatIndentMoney(item.rc_package_value_limit)
      : "value not entered";
    return `Common pool ${quantity} + ${value}`;
  }
  if (type === "validity_only") return "Validity-only package";
  return "No fixed package quantity/value";
};

export const formatRcLineCap = (item = {}) => {
  const type = String(item.rc_line_cap_type || "no_separate_cap");
  if (type === "rate_only") return "Rate only";
  if (type === "quantity") {
    return `Line cap ${formatIndentQuantity(item.rc_line_quantity_limit)} ${item.unit || ""}`.trim();
  }
  if (type === "value") return `Line cap ${formatIndentMoney(item.rc_line_value_limit)}`;
  if (type === "quantity_value") {
    const quantity = item.rc_line_quantity_limit
      ? `${formatIndentQuantity(item.rc_line_quantity_limit)} ${item.unit || ""}`.trim()
      : "quantity not entered";
    const value = item.rc_line_value_limit
      ? formatIndentMoney(item.rc_line_value_limit)
      : "value not entered";
    return `Line cap ${quantity} + ${value}`;
  }
  return "Uses common package pool";
};

export const formatIndentItemPrimaryMeasure = (item = {}) => {
  const scopeType = String(item.procurement_scope_type || "standard_quantity");

  if (scopeType === "rate_contract_time_only") {
    return "No fixed quantity/value limit";
  }

  if (scopeType === "rate_contract_framework") {
    const packageName = item.rc_package_name || "RC package not named";
    return `${packageName} • ${formatRcPackageLimit(item)} • ${formatRcLineCap(item)}`;
  }

  if (scopeType === "rate_contract_value") {
    return item.contract_value_limit
      ? `Value limit ${formatIndentMoney(item.contract_value_limit)}`
      : "Value limit not entered";
  }

  if (scopeType === "rate_contract_quantity_value") {
    const quantityLimit = item.contract_quantity_limit || item.quantity;
    const quantity = quantityLimit
      ? `Quantity limit ${formatIndentQuantity(quantityLimit)} ${item.unit || ""}`.trim()
      : "Quantity limit not entered";
    const value = item.contract_value_limit
      ? `Value limit ${formatIndentMoney(item.contract_value_limit)}`
      : "Value limit not entered";
    return `${quantity} • ${value}`;
  }

  const quantity = item.quantity ? formatIndentQuantity(item.quantity) : "";
  const unit = item.unit || "";
  return [quantity, unit].filter(Boolean).join(" ") || "Quantity not entered";
};

export const formatIndentItemScopeSummary = (item = {}) => {
  const scope = getIndentItemScopeLabel(item.procurement_scope_type);
  const measure = formatIndentItemPrimaryMeasure(item);
  const period = formatIndentContractPeriod(item);
  const extension = formatIndentContractExtension(item);

  if (String(item.procurement_scope_type || "standard_quantity") === "standard_quantity") {
    return measure;
  }

  return [scope, measure, period ? `Period ${period}` : "", extension]
    .filter(Boolean)
    .join(" • ");
};
