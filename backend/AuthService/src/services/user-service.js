"use strict";

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const UserRepository = require("../repository/user-repository");
const { JWT_KEY } = require("../config/server-config");
const {
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX,
} = require("../utils/password-policy");

class UserService {
  constructor() {
    this.userRepository = new UserRepository();
  }

  createToken(user) {
    if (!JWT_KEY || JWT_KEY.length < 32) {
      const error = new Error("JWT_KEY must be configured and at least 32 characters long.");
      error.statusCode = 500;
      throw error;
    }

    return jwt.sign(
      {
        id: user.id,
        empcode: user.empcode,
        passwordVersion: Number(user.password_version || 0),
      },
      JWT_KEY,
      { expiresIn: "1d" },
    );
  }

  verifyToken(token) {
    return jwt.verify(token, JWT_KEY);
  }

  checkPassword(plainPassword, encryptedPassword) {
    return bcrypt.compareSync(String(plainPassword || ""), String(encryptedPassword || ""));
  }

  buildSessionPayload(user) {
    const roles = Array.isArray(user?.roles) ? user.roles.map((role) => role.name) : [];
    return {
      empcode: user.empcode,
      fullName: user.fullname,
      mobileno: user.mobileno,
      designation: user.designation,
      division: user.department,
      location_scope: user.location_scope,
      roles,
      newJWT: this.createToken(user),
      mustChangePassword: Boolean(user.must_change_password),
      passwordChangedAt: user.password_changed_at || null,
    };
  }

  normalizeText(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  normalizeMobile(value) {
    return String(value || "").replace(/\D/g, "").trim();
  }

  normalizeRoleNames(value) {
    const rawRoles = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(",")
        : [];

    return Array.from(
      new Set(
        rawRoles
          .map((role) => this.normalizeText(role).toUpperCase())
          .map((role) => role.replace(/[\s-]+/g, "_").replace(/_+/g, "_"))
          .filter(Boolean),
      ),
    );
  }

  serializeUserIdentity(user) {
    if (!user) return null;
    return {
      id: user.id,
      empcode: user.empcode,
      fullname: user.fullname,
      mobileno: user.mobileno,
      designation: user.designation,
      department: user.department,
      location_scope: user.location_scope,
      must_change_password: Boolean(user.must_change_password),
      roles: Array.isArray(user.roles) ? user.roles.map((role) => role.name) : [],
    };
  }

  buildActivationPayload(data = {}) {
    return {
      empcode: this.normalizeText(data.empcode),
      fullname: this.normalizeText(data.fullname || data.employee_name),
      mobileno: this.normalizeMobile(data.mobileno || data.mobile_no),
      designation: this.normalizeText(data.designation),
      department: this.normalizeText(data.department || data.division),
      location_scope: this.normalizeText(data.location_scope).toUpperCase(),
      assigned_roles: this.normalizeRoleNames(data.assigned_roles),
      password: String(data.newPassword || data.password || ""),
      confirmPassword: String(data.confirmPassword || ""),
    };
  }

  validateActivationPayload(payload = {}, options = {}) {
    const errors = [];
    if (!payload.empcode) errors.push("Employee code is required.");
    if (!payload.fullname) errors.push("Employee name is required.");
    if (!/^[6-9]\d{9}$/.test(payload.mobileno || "")) {
      errors.push("Registered mobile number must be a valid 10 digit number.");
    }
    if (!payload.designation) errors.push("Designation is required.");
    if (!payload.department) errors.push("Division is required.");
    if (!payload.location_scope) errors.push("Location scope is required.");

    if (options.requirePassword) {
      if (!payload.password) errors.push("New password is required.");
      if (!payload.confirmPassword) errors.push("Confirm password is required.");
      if (payload.password !== payload.confirmPassword) {
        errors.push("New password and confirm password must match.");
      }
      if (payload.password && !PASSWORD_POLICY_REGEX.test(payload.password)) {
        errors.push(PASSWORD_POLICY_MESSAGE);
      }
    }

    if (errors.length) {
      const error = new Error(
        options.requirePassword
          ? "Employee activation payload is invalid."
          : "Employee activation preview payload is invalid.",
      );
      error.statusCode = 400;
      error.code = options.requirePassword
        ? "INVALID_ACTIVATION_PAYLOAD"
        : "INVALID_ACTIVATION_PREVIEW_PAYLOAD";
      error.hint = options.requirePassword
        ? "Correct the activation details and password requirements, then try again."
        : "Correct the employee activation details and try again.";
      error.data = { details: errors };
      throw error;
    }
  }

  resolveExistingActivationState(user) {
    if (!user) return "already_exists";
    return user.must_change_password ? "provisioned" : "active";
  }

  async previewActivationFromEmployee(data = {}, context = {}) {
    const payload = this.buildActivationPayload(data);
    this.validateActivationPayload(payload, { requirePassword: false });

    const existingUser = await this.userRepository.findConflictingUser({
      empcode: payload.empcode,
      mobileno: payload.mobileno,
    });

    if (existingUser) {
      return {
        eligible: false,
        action: "already_exists",
        activation_state: this.resolveExistingActivationState(existingUser),
        source_service: this.normalizeText(context?.serviceName) || null,
        user: this.serializeUserIdentity(existingUser),
      };
    }

    return {
      eligible: true,
      action: "activate",
      activation_state: "ready",
      source_service: this.normalizeText(context?.serviceName) || null,
      user: null,
    };
  }

  async activateFromEmployee(data = {}, context = {}) {
    const payload = this.buildActivationPayload(data);
    this.validateActivationPayload(payload, { requirePassword: true });

    const preview = await this.previewActivationFromEmployee(payload, context);
    if (preview.action === "already_exists") {
      const error = new Error("An account already exists for this employee.");
      error.statusCode = 409;
      error.code = "ACCOUNT_ALREADY_EXISTS";
      error.hint =
        "Please sign in with your existing credentials or contact the administrator.";
      error.data = {
        activation_state: preview.activation_state,
        user: preview.user,
      };
      throw error;
    }

    const createdUser = await this.userRepository.create(
      {
        empcode: payload.empcode,
        fullname: payload.fullname,
        mobileno: payload.mobileno,
        password: payload.password,
        designation: payload.designation,
        department: payload.department,
        location_scope: payload.location_scope,
        must_change_password: false,
        password_version: 0,
        password_changed_at: new Date(),
      },
      {
        roleNames: payload.assigned_roles,
      },
    );

    return {
      action: "activated",
      activation_state: "active",
      source_service: this.normalizeText(context?.serviceName) || null,
      user: this.serializeUserIdentity(createdUser),
    };
  }

  async syncRolesFromEmployee(data = {}, context = {}) {
    const payload = this.buildActivationPayload(data);
    this.validateActivationPayload(payload, { requirePassword: false });

    const syncedUser = await this.userRepository.syncEmployeeRolesByEmpcode({
      empcode: payload.empcode,
      fullname: payload.fullname,
      mobileno: payload.mobileno,
      designation: payload.designation,
      division: payload.department,
      location_scope: payload.location_scope,
      assigned_roles: payload.assigned_roles,
    });

    return {
      action: syncedUser ? "synced" : "not_found",
      activation_state: syncedUser ? "active" : "not_activated",
      source_service: this.normalizeText(context?.serviceName) || null,
      user: this.serializeUserIdentity(syncedUser),
    };
  }

  async signIn(mobileno, plainPassword) {
    const user = await this.userRepository.getByMobileNo(mobileno);
    if (!user) {
      const error = new Error("Invalid credentials");
      error.statusCode = 401;
      error.code = "INVALID_CREDENTIALS";
      throw error;
    }

    const passwordMatch = this.checkPassword(plainPassword, user.password);
    if (!passwordMatch) {
      const error = new Error("Invalid credentials");
      error.statusCode = 401;
      error.code = "INVALID_CREDENTIALS";
      throw error;
    }

    return this.buildSessionPayload(user);
  }

  async isAuthenticated(token) {
    if (!String(token || "").trim()) {
      const error = new Error("Authentication token is missing.");
      error.statusCode = 401;
      error.code = "TOKEN_MISSING";
      throw error;
    }

    const decoded = this.verifyToken(token);
    const user = await this.userRepository.getById(decoded.id);
    if (!user) {
      const error = new Error("No active account found for this session.");
      error.statusCode = 401;
      error.code = "USER_NOT_FOUND";
      throw error;
    }

    return {
      id: user.id,
      empcode: user.empcode,
      fullname: user.fullname,
      mobileno: user.mobileno,
      designation: user.designation,
      department: user.department,
      location_scope: user.location_scope,
      roles: Array.isArray(user.roles) ? user.roles.map((role) => role.name) : [],
      must_change_password: Boolean(user.must_change_password),
      password_changed_at: user.password_changed_at || null,
    };
  }
}

module.exports = UserService;
