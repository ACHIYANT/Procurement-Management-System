import { postProcurement, procurementRequest } from "@/lib/procurement-api";
import { getCurrentUserProfile, getCurrentUserRoles } from "@/lib/roles";

export async function requestSavedRecordChange({
  moduleKey,
  entityType,
  entityId,
  title,
  oldPayload = null,
  proposedPayload = {},
}) {
  const message = window.prompt(
    "Write the message for the approver. Mention what you want to change and why.",
    "",
  );
  if (message === null) return null;
  if (!String(message).trim()) {
    const error = new Error("Approver message is required.");
    error.statusCode = 400;
    throw error;
  }

  const profile = getCurrentUserProfile() || {};
  return postProcurement("/approvals/requests", {
    module_key: moduleKey,
    action_key: "change_saved_record",
    entity_type: entityType,
    entity_id: entityId,
    request_title: title || `Change request for ${entityType} #${entityId}`,
    request_reason: message,
    old_payload: oldPayload,
    proposed_payload: proposedPayload,
    actor_employee_id: profile.employee_id || profile.id || null,
    actor_name:
      profile.employee_name ||
      profile.fullname ||
      profile.fullName ||
      localStorage.getItem("fullname") ||
      "",
    actor_roles: getCurrentUserRoles(),
  });
}

export async function findApprovedSavedRecordChange({
  moduleKey,
  entityType,
  entityId,
}) {
  const params = new URLSearchParams({
    module_key: moduleKey,
    action_key: "change_saved_record",
    entity_type: entityType,
    entity_id: String(entityId),
    status: "approved",
  });
  const rows = await procurementRequest(`/approvals/requests?${params.toString()}`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

export function getSavedRecordUpdatePath({
  moduleKey,
  entityType,
  entityId,
  approvalRequestId,
}) {
  const id = encodeURIComponent(String(entityId || ""));
  const requestQuery = approvalRequestId
    ? `?approvalRequestId=${encodeURIComponent(String(approvalRequestId))}`
    : "";
  const key = `${moduleKey}:${entityType}`;

  const routes = {
    "indents:indent": `/indents/${id}/edit${requestQuery}`,
    "procurementCases:procurement_case": `/procurement-cases/${id}/edit${requestQuery}`,
    "tenders:tender": `/tenders/${id}${requestQuery}`,
    "purchaseOrders:purchase_order": `/purchase-orders/${id}${requestQuery}`,
    "emd:emd_entry": `/emd/${id}/edit${requestQuery}`,
    "pbg:pbg_entry": `/pbg/${id}/edit${requestQuery}`,
    "committees:committee_meeting": `/committees/${id}${requestQuery}`,
    "departmentFunds:department_fund": `/department-funds${requestQuery}`,
  };

  return routes[key] || "";
}
