"use strict";

const ProcurementEmployeeRepository = require("../repository/procurement-employee-repository");
const {
  buildActivationError,
  executeEmployeeActivationInAuthService,
  validateEmployeeActivationInAuthService,
} = require("../utils/auth-activation-api");

const normalizeText = (value) => {
  const text = String(value || "").trim();
  return text || "";
};

const normalizeMobile = (value) => String(value || "").trim().replace(/\D/g, "");

const maskMobile = (value) => {
  const mobile = normalizeMobile(value);
  if (mobile.length < 4) return "Not available";
  return `${mobile.slice(0, 2)}******${mobile.slice(-2)}`;
};

class AccountActivationService {
  constructor() {
    this.employeeRepository = new ProcurementEmployeeRepository();
  }

  buildEmployeeSnapshot(employee) {
    return {
      id: employee.id,
      empcode: employee.empcode,
      employee_name: employee.employee_name,
      designation: employee.designation,
      division: employee.division,
      location_scope: employee.location_scope,
      assigned_roles: Array.isArray(employee.assigned_roles) ? employee.assigned_roles : [],
      masked_mobile_no: maskMobile(employee.mobile_no),
    };
  }

  async verifyEmployeeIdentity({ empcode, mobileno } = {}) {
    const normalizedEmpcode = normalizeText(empcode);
    const normalizedMobile = normalizeMobile(mobileno);

    if (!normalizedEmpcode) {
      throw buildActivationError({
        statusCode: 400,
        code: "EMPLOYEE_CODE_REQUIRED",
        message: "Employee code is required.",
        hint: "Enter a valid employee code to continue.",
      });
    }

    if (!normalizedMobile) {
      throw buildActivationError({
        statusCode: 400,
        code: "MOBILE_NUMBER_REQUIRED",
        message: "Registered mobile number is required.",
        hint: "Enter the mobile number linked to your procurement employee record.",
      });
    }

    const employee = await this.employeeRepository.getByEmpcode(normalizedEmpcode);
    if (!employee) {
      throw buildActivationError({
        statusCode: 404,
        code: "EMPLOYEE_NOT_FOUND_IN_PMS",
        message: "No procurement employee record was found for this employee code.",
        hint: "Contact the administrator to complete procurement employee onboarding.",
      });
    }

    if (!employee.is_active) {
      throw buildActivationError({
        statusCode: 403,
        code: "EMPLOYEE_INACTIVE",
        message: "This procurement employee record is inactive.",
        hint: "Ask the administrator to activate the employee record first.",
      });
    }

    if (!normalizeMobile(employee.mobile_no)) {
      throw buildActivationError({
        statusCode: 409,
        code: "EMPLOYEE_MOBILE_NOT_AVAILABLE",
        message: "This procurement employee record does not have a registered mobile number.",
        hint: "Please ask the administrator to update the employee master first.",
      });
    }

    if (normalizeMobile(employee.mobile_no) !== normalizedMobile) {
      throw buildActivationError({
        statusCode: 403,
        code: "EMPLOYEE_VERIFICATION_FAILED",
        message: "The provided details do not match the procurement employee master record.",
        hint: "Use the registered mobile number linked to your employee code.",
      });
    }

    return employee;
  }

  async validate({ empcode, mobileno } = {}, context = {}) {
    const employee = await this.verifyEmployeeIdentity({ empcode, mobileno });
    const preview = await validateEmployeeActivationInAuthService(employee.toJSON(), {
      requestId: context?.requestId || null,
    });

    return {
      eligible: preview?.action === "activate",
      action: preview?.action || "activate",
      activation_state:
        preview?.activation_state ||
        (preview?.action === "already_exists" ? "already_exists" : "ready"),
      employee: this.buildEmployeeSnapshot(employee),
      auth: preview?.user
        ? {
            id: preview.user.id || null,
            empcode: preview.user.empcode || employee.empcode,
            must_change_password: Boolean(preview.user.must_change_password),
            roles: Array.isArray(preview.user.roles) ? preview.user.roles : [],
          }
        : null,
    };
  }

  async execute(
    { empcode, mobileno, newPassword, confirmPassword } = {},
    context = {},
  ) {
    const employee = await this.verifyEmployeeIdentity({ empcode, mobileno });
    const result = await executeEmployeeActivationInAuthService(
      employee.toJSON(),
      { newPassword, confirmPassword },
      { requestId: context?.requestId || null },
    );

    return {
      activated: true,
      action: result?.action || "activated",
      activation_state: result?.activation_state || "active",
      employee: this.buildEmployeeSnapshot(employee),
      auth: result?.user
        ? {
            id: result.user.id || null,
            empcode: result.user.empcode || employee.empcode,
            must_change_password: Boolean(result.user.must_change_password),
            roles: Array.isArray(result.user.roles) ? result.user.roles : [],
          }
        : null,
    };
  }
}

module.exports = {
  AccountActivationService,
  buildActivationError,
};
