"use strict";

const axios = require("axios");

const normalizeText = (value) => {
  const text = String(value || "").trim();
  return text || "";
};

const buildActivationError = ({
  statusCode = 500,
  code = "AUTH_ACTIVATION_FAILED",
  message = "Unable to activate the Auth account.",
  hint = "Please try again in a moment.",
  details = [],
  upstreamRequestId = null,
} = {}) => ({
  statusCode,
  code,
  message,
  hint,
  details: Array.isArray(details)
    ? details.map((entry) => normalizeText(entry)).filter(Boolean)
    : [],
  upstreamRequestId: normalizeText(upstreamRequestId) || null,
});

const normalizeBaseUrl = (value) => normalizeText(value).replace(/\/+$/, "");

const buildActivationPayload = (
  employee = {},
  { newPassword = "", confirmPassword = "" } = {},
) => {
  const payload = {
    empcode: employee?.empcode,
    fullname: employee?.employee_name,
    mobileno: employee?.mobile_no,
    designation: employee?.designation,
    division: employee?.division,
    location_scope: employee?.location_scope,
    assigned_roles: Array.isArray(employee?.assigned_roles) ? employee.assigned_roles : [],
  };

  if (String(newPassword || "")) payload.newPassword = String(newPassword);
  if (String(confirmPassword || "")) payload.confirmPassword = String(confirmPassword);

  return payload;
};

async function callAuthActivationApi(
  mode = "validate",
  employeePayload = {},
  credentials = {},
  options = {},
) {
  const baseUrl = normalizeBaseUrl(
    process.env.AUTH_BASE_URL || "http://localhost:3001/api/v1",
  );
  const sharedSecret = normalizeText(
    process.env.AUTH_INTERNAL_SERVICE_KEY ||
      process.env.INTERNAL_SERVICE_SHARED_SECRET ||
      "",
  );
  const serviceName =
    normalizeText(options?.serviceName) ||
    normalizeText(process.env.AUTH_INTERNAL_SERVICE_NAME) ||
    "ProcurementManagementService";
  const normalizedMode = normalizeText(mode).toLowerCase();

  if (!["validate", "execute"].includes(normalizedMode)) {
    throw buildActivationError({
      statusCode: 500,
      code: "AUTH_ACTIVATION_MODE_INVALID",
      message: "Activation mode is invalid.",
      hint: "Use a valid activation mode and try again.",
    });
  }

  if (!baseUrl) {
    throw buildActivationError({
      statusCode: 503,
      code: "AUTH_ACTIVATION_NOT_CONFIGURED",
      message: "Auth activation endpoint is not configured.",
      hint: "Configure AUTH_BASE_URL in Procurement service and try again.",
    });
  }

  if (!sharedSecret) {
    throw buildActivationError({
      statusCode: 503,
      code: "AUTH_ACTIVATION_NOT_CONFIGURED",
      message: "Procurement-to-Auth activation credential is not configured.",
      hint: "Configure AUTH_INTERNAL_SERVICE_KEY and try again.",
    });
  }

  const requestId = normalizeText(options?.requestId) || undefined;

  try {
    const response = await axios.post(
      `${baseUrl}/internal/users/activate-from-employee/${normalizedMode}`,
      buildActivationPayload(employeePayload, credentials),
      {
        headers: {
          "x-internal-service-key": sharedSecret,
          "x-internal-service-name": serviceName,
          "x-request-id": requestId,
        },
        timeout: Number(process.env.AUTH_REQUEST_TIMEOUT_MS || 5000),
      },
    );

    return {
      action: normalizeText(response?.data?.data?.action) || "activated",
      activation_state:
        normalizeText(response?.data?.data?.activation_state) || null,
      user: response?.data?.data?.user || null,
      requestId:
        normalizeText(response?.headers?.["x-request-id"]) ||
        normalizeText(response?.data?.requestId) ||
        null,
    };
  } catch (error) {
    const payload = error?.response?.data || {};
    const upstreamRequestId =
      normalizeText(error?.response?.headers?.["x-request-id"]) ||
      normalizeText(payload?.requestId) ||
      null;

    if (error?.response) {
      throw buildActivationError({
        statusCode: Number(error.response.status || 500),
        code:
          normalizeText(payload?.code || payload?.err?.code) ||
          "AUTH_ACTIVATION_FAILED",
        message:
          normalizeText(payload?.message || payload?.err?.message) ||
          "Unable to activate the Auth account.",
        hint:
          normalizeText(payload?.hint) ||
          "Please review the employee details and try again.",
        details: Array.isArray(payload?.details)
          ? payload.details
          : Array.isArray(payload?.data?.details)
            ? payload.data.details
            : [],
        upstreamRequestId,
      });
    }

    if (error?.code === "ECONNABORTED") {
      throw buildActivationError({
        statusCode: 503,
        code: "AUTH_ACTIVATION_TIMEOUT",
        message: "Auth activation request timed out.",
        hint: "Please try again in a moment.",
        upstreamRequestId,
      });
    }

    throw buildActivationError({
      statusCode: 503,
      code: "AUTH_ACTIVATION_UNREACHABLE",
      message: "Auth activation service could not be reached.",
      hint: "Please try again in a moment.",
      upstreamRequestId,
    });
  }
}

const validateEmployeeActivationInAuthService = (employeePayload = {}, options = {}) =>
  callAuthActivationApi("validate", employeePayload, {}, options);

const executeEmployeeActivationInAuthService = (
  employeePayload = {},
  credentials = {},
  options = {},
) => callAuthActivationApi("execute", employeePayload, credentials, options);

module.exports = {
  buildActivationError,
  validateEmployeeActivationInAuthService,
  executeEmployeeActivationInAuthService,
};
