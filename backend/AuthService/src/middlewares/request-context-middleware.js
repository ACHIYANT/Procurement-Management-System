"use strict";

const { randomUUID } = require("crypto");

const requestContextMiddleware = (req, res, next) => {
  const requestId = String(req.headers["x-request-id"] || "").trim() || randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  return next();
};

module.exports = {
  requestContextMiddleware,
};
