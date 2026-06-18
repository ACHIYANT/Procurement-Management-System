"use strict";

const express = require("express");
const UserController = require("../controllers/user-controller");
const { validateUserAuth } = require("../middlewares/auth-request-validators");
const { authSignInRateLimiter } = require("../middlewares/security-middleware");
const { ensureInternalService } = require("../middlewares/internal-service-middleware");

const router = express.Router();

router.post(
  "/internal/users/activate-from-employee/validate",
  ensureInternalService,
  UserController.validateActivateFromEmployee,
);
router.post(
  "/internal/users/activate-from-employee/execute",
  ensureInternalService,
  UserController.executeActivateFromEmployee,
);
router.post(
  "/internal/users/sync-employee-roles",
  ensureInternalService,
  UserController.syncEmployeeRoles,
);
router.post("/signin", authSignInRateLimiter, validateUserAuth, UserController.signIn);
router.post("/signout", UserController.signOut);
router.get("/csrf-token", UserController.getCsrfToken);
router.get("/is-authenticated", UserController.isAuthenticated);

module.exports = router;
