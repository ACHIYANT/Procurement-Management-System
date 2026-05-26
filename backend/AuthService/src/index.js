const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const {
  buildCorsOptions,
  apiRateLimiter,
  sanitizeJsonErrorResponses,
  securityHeaders,
} = require("./middlewares/security-middleware");
const { csrfProtection } = require("./middlewares/csrf-middleware");
const {
  requestContextMiddleware,
} = require("./middlewares/request-context-middleware");
const { PORT, JWT_KEY } = require("./config/server-config");

const app = express();

if (!JWT_KEY || JWT_KEY.length < 32) {
  throw new Error("JWT_KEY must be configured and at least 32 characters long.");
}

app.disable("x-powered-by");
app.use(cors(buildCorsOptions()));
app.options(/.*/, cors(buildCorsOptions()));
app.use(securityHeaders);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestContextMiddleware);
app.use(apiRateLimiter);
app.use(sanitizeJsonErrorResponses);
app.use(
  "/api",
  csrfProtection({
    skipPaths: [
      "/v1/signin",
      "/v1/csrf-token",
      "/v1/internal/users/activate-from-employee/validate",
      "/v1/internal/users/activate-from-employee/execute",
    ],
  }),
);

app.use("/api/v1", routes);

app.use((error, _req, res, _next) => {
  return res.status(500).json({
    success: false,
    message: error?.message || "Internal server error",
    data: {},
    err: {},
  });
});

app.listen(PORT, () => {
  console.log(`AuthService started on port ${PORT}`);
});
