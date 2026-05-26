const trimTrailingSlash = (value = "") => String(value || "").replace(/\/+$/, "");

const DEFAULT_AUTH_API_URL = "/api/auth/v1";
const DEFAULT_PROCUREMENT_API_URL = "/api/procurement/v1";

export const AUTH_API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_AUTH_API_URL || DEFAULT_AUTH_API_URL,
);

export const PROCUREMENT_API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_PROCUREMENT_API_URL || DEFAULT_PROCUREMENT_API_URL,
);

const normalizePath = (path = "") => {
  const raw = String(path || "").trim();
  if (!raw) return "";
  return raw.startsWith("/") ? raw : `/${raw}`;
};

export const toAuthApiUrl = (path = "") =>
  `${AUTH_API_BASE_URL}${normalizePath(path)}`;

export const toProcurementApiUrl = (path = "") =>
  `${PROCUREMENT_API_BASE_URL}${normalizePath(path)}`;
