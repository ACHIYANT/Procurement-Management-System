"use strict";

const DEFAULT_ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
const DEFAULT_ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "x-access-token",
  "x-csrf-token",
  "x-request-id",
];
const DEFAULT_EXPOSED_HEADERS = ["x-request-id", "retry-after"];

const toPosInt = (value, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
};

const parseCsv = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

function buildCorsOptions() {
  const allowedOrigins = parseCsv(process.env.CORS_ALLOWED_ORIGINS);
  const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const allowAnyInDev =
    String(process.env.CORS_DEV_ALLOW_ANY || "true").toLowerCase() !== "false";

  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (!isProduction && allowAnyInDev) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS_NOT_ALLOWED"));
    },
    credentials: true,
    methods: DEFAULT_ALLOWED_METHODS,
    allowedHeaders: DEFAULT_ALLOWED_HEADERS,
    exposedHeaders: DEFAULT_EXPOSED_HEADERS,
    maxAge: toPosInt(process.env.CORS_MAX_AGE_SECONDS, 86400),
  };
}

function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
}

function createInMemoryRateLimiter({ windowMs, maxRequests, keyGenerator, message }) {
  const store = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (!value || value.resetAt <= now) store.delete(key);
    }
  }, Math.max(windowMs, 60_000)).unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = String(keyGenerator(req) || req.ip || "anon");
    const current = store.get(key);

    if (!current || current.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    store.set(key, current);

    if (current.count > maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        success: false,
        message: message || "Too many requests. Please try again later.",
        data: {},
        err: {},
      });
    }

    return next();
  };
}

const apiRateLimiter = createInMemoryRateLimiter({
  windowMs: toPosInt(process.env.API_RATE_LIMIT_WINDOW_MS, 60_000),
  maxRequests: toPosInt(process.env.API_RATE_LIMIT_MAX, 300),
  keyGenerator: (req) => req.ip,
  message: "Too many API requests from this IP.",
});

const authSignInRateLimiter = createInMemoryRateLimiter({
  windowMs: toPosInt(process.env.SIGNIN_RATE_LIMIT_WINDOW_MS, 15 * 60_000),
  maxRequests: toPosInt(process.env.SIGNIN_RATE_LIMIT_MAX, 15),
  keyGenerator: (req) =>
    `${req.ip || "unknown-ip"}|${String(req.body?.mobileno || "").trim() || "unknown-mobile"}`,
  message: "Too many sign-in attempts. Please try again after some time.",
});

function sanitizeJsonErrorResponses(_req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    if (!payload || typeof payload !== "object" || !("err" in payload)) {
      return originalJson(payload);
    }

    if (Number(res.statusCode || 200) >= 500) {
      return originalJson({
        ...payload,
        err: {},
      });
    }

    return originalJson(payload);
  };
  next();
}

module.exports = {
  apiRateLimiter,
  authSignInRateLimiter,
  buildCorsOptions,
  sanitizeJsonErrorResponses,
  securityHeaders,
};
