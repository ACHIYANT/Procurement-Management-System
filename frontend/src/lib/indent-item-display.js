const SCOPE_LABELS = {
  standard_quantity: "Standard Purchase",
  amc: "AMC",
  camc: "CAMC",
  rate_contract_quantity: "RC - Quantity",
  rate_contract_value: "RC - Value",
};

export const getIndentItemScopeLabel = (value) =>
  SCOPE_LABELS[String(value || "standard_quantity")] || "Standard Purchase";

export const isValueRateContractItem = (item = {}) =>
  item.procurement_scope_type === "rate_contract_value";

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

export const formatIndentItemPrimaryMeasure = (item = {}) => {
  if (isValueRateContractItem(item)) {
    return item.contract_value_limit
      ? `Value limit ${formatIndentMoney(item.contract_value_limit)}`
      : "Value limit not entered";
  }

  const quantity = item.quantity ? formatIndentQuantity(item.quantity) : "";
  const unit = item.unit || "";
  return [quantity, unit].filter(Boolean).join(" ") || "Quantity not entered";
};

export const formatIndentItemScopeSummary = (item = {}) => {
  const scope = getIndentItemScopeLabel(item.procurement_scope_type);
  const measure = formatIndentItemPrimaryMeasure(item);
  const period = formatIndentContractPeriod(item);

  if (String(item.procurement_scope_type || "standard_quantity") === "standard_quantity") {
    return measure;
  }

  return [scope, measure, period ? `Period ${period}` : ""]
    .filter(Boolean)
    .join(" • ");
};
