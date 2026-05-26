"use strict";

require("dotenv").config();

const parseCsv = (value = "") =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

module.exports = {
  PORT: Number(process.env.PORT || 3001),
  JWT_KEY: String(process.env.JWT_KEY || "").trim(),
  SALT_ROUNDS: Number(process.env.BCRYPT_SALT_ROUNDS || 12),
  INTERNAL_SERVICE_SHARED_SECRET:
    String(
      process.env.INTERNAL_SERVICE_SHARED_SECRET ||
      process.env.AUTH_INTERNAL_SERVICE_KEY ||
      "",
    ).trim(),
  INTERNAL_ALLOWED_SERVICE_NAMES: parseCsv(
    process.env.INTERNAL_ALLOWED_SERVICE_NAMES || "ProcurementManagementService",
  ),
};
