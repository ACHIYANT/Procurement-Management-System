"use strict";

const jwt = require("jsonwebtoken");
const { JWT_KEY } = require("../config/server-config");
const { AUTH_COOKIE_NAME, parseCookies } = require("../utils/cookie-utils");

const extractToken = (req) => {
  const explicitToken =
    req.headers["x-access-token"] ||
    String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (String(explicitToken || "").trim()) return String(explicitToken).trim();

  const cookies = parseCookies(req.headers.cookie || "");
  return String(cookies[AUTH_COOKIE_NAME] || "").trim();
};

const ensureAuth = (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is missing.",
      data: {},
      err: {
        code: "TOKEN_MISSING",
        message: "Please log in again.",
      },
    });
  }

  try {
    req.user = jwt.verify(token, JWT_KEY);
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session.",
      data: {},
      err: {
        code: "TOKEN_INVALID",
        message: "Please log in again.",
      },
    });
  }
};

module.exports = {
  ensureAuth,
  extractToken,
};
