"use strict";

const UserService = require("../services/user-service");
const {
  AUTH_COOKIE_NAME,
  clearSessionCookies,
  generateCsrfToken,
  parseCookies,
  setSessionCookies,
} = require("../utils/cookie-utils");
const {
  buildSuccessPayload,
  sendError,
} = require("../utils/auth-response-utils");
const { extractToken } = require("../middlewares/auth-middleware");

const userService = new UserService();

const signIn = async (req, res) => {
  try {
    const response = await userService.signIn(req.body?.mobileno, req.body?.password);
    const csrfToken = generateCsrfToken();
    setSessionCookies(res, response.newJWT, csrfToken);

    return res.status(200).json(
      buildSuccessPayload(
        req,
        res,
        {
          empcode: response.empcode,
          fullName: response.fullName,
          mobileno: response.mobileno,
          designation: response.designation,
          division: response.division,
          location_scope: response.location_scope,
          roles: response.roles || [],
          csrfToken,
          mustChangePassword: Boolean(response.mustChangePassword),
          passwordChangedAt: response.passwordChangedAt || null,
        },
        {
          message: "Signed in successfully.",
        },
      ),
    );
  } catch (error) {
    return sendError(req, res, error, {
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
      message: "Invalid credentials",
      hint: "Please check your mobile number and password and try again.",
    });
  }
};

const signOut = async (req, res) => {
  clearSessionCookies(res);
  return res.status(200).json(
    buildSuccessPayload(req, res, {}, {
      message: "Signed out successfully.",
    }),
  );
};

const getCsrfToken = async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || "");
  const csrfToken = cookies.csrf_token || generateCsrfToken();
  if (!cookies.csrf_token) {
    setSessionCookies(res, cookies[AUTH_COOKIE_NAME], csrfToken);
  }

  return res.status(200).json(
    buildSuccessPayload(req, res, { csrfToken }, { message: "CSRF token issued." }),
  );
};

const isAuthenticated = async (req, res) => {
  try {
    const token = extractToken(req);
    const response = await userService.isAuthenticated(token);
    return res.status(200).json(
      buildSuccessPayload(req, res, response, {
        message: "Session is active.",
      }),
    );
  } catch (error) {
    return sendError(req, res, error, {
      statusCode: 401,
      code: "TOKEN_INVALID",
      message: "Session is not active.",
      hint: "Please log in again.",
    });
  }
};

const validateActivateFromEmployee = async (req, res) => {
  try {
    const response = await userService.previewActivationFromEmployee(req.body || {}, {
      serviceName: req.internalService?.serviceName || null,
    });
    return res.status(200).json(
      buildSuccessPayload(req, res, response, {
        statusCode: 200,
        message:
          response?.action === "already_exists"
            ? "Account already exists for this employee."
            : "Employee activation request validated successfully.",
      }),
    );
  } catch (error) {
    return sendError(req, res, error, {
      statusCode: 500,
      code: "ACTIVATION_VALIDATE_FAILED",
      message: "Unable to validate employee activation request.",
      hint: "Please try again in a moment.",
    });
  }
};

const executeActivateFromEmployee = async (req, res) => {
  try {
    const response = await userService.activateFromEmployee(req.body || {}, {
      serviceName: req.internalService?.serviceName || null,
    });
    return res.status(201).json(
      buildSuccessPayload(req, res, response, {
        statusCode: 201,
        message: "User account activated from employee successfully.",
      }),
    );
  } catch (error) {
    return sendError(req, res, error, {
      statusCode: 500,
      code: "ACTIVATION_EXECUTE_FAILED",
      message: "Unable to activate user from employee.",
      hint: "Please try again in a moment.",
    });
  }
};

module.exports = {
  signIn,
  signOut,
  getCsrfToken,
  isAuthenticated,
  validateActivateFromEmployee,
  executeActivateFromEmployee,
};
