"use strict";

const normalizeText = (value) => {
  const text = String(value || "").trim();
  return text || "";
};

const getRequestId = (req, res) =>
  normalizeText(res?.getHeader?.("x-request-id")) ||
  normalizeText(req?.requestId) ||
  null;

const buildSuccessPayload = (req, res, data = {}, options = {}) => ({
  success: true,
  statusCode: Number(options.statusCode || 200),
  message: normalizeText(options.message) || "Request completed successfully.",
  data,
  requestId: getRequestId(req, res),
  err: {},
});

const sendError = (req, res, error = {}, fallback = {}) => {
  const statusCode = Number(error?.statusCode || fallback?.statusCode || 500);
  const code =
    normalizeText(error?.code || fallback?.code) || "INTERNAL_SERVER_ERROR";
  const message =
    normalizeText(error?.message || fallback?.message) ||
    (statusCode >= 500 ? "Internal server error." : "Request failed.");
  const hint = normalizeText(error?.hint || fallback?.hint);

  return res.status(statusCode).json({
    success: false,
    statusCode,
    code,
    message,
    hint,
    requestId: getRequestId(req, res),
    data:
      error?.data && typeof error.data === "object" && !Array.isArray(error.data)
        ? error.data
        : {},
    err: {
      code,
      message,
    },
  });
};

module.exports = {
  buildSuccessPayload,
  sendError,
};
