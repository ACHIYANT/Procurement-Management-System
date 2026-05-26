const ProcurementEmployeeRepository = require("../repository/procurement-employee-repository");
const {
  buildCursorResponse,
  isCursorMode,
  normalizeCursor,
  normalizeLimit,
  normalizeSortBy,
  normalizeSortDirection,
} = require("../utils/procurement-domain");

const PROCUREMENT_EMPLOYEE_SORT_FIELDS = [
  "id",
  "empcode",
  "employee_name",
  "designation",
  "division",
  "mobile_no",
  "location_scope",
  "is_active",
];

class ProcurementEmployeeService {
  constructor() {
    this.repository = new ProcurementEmployeeRepository();
  }

  normalizeText(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  normalizeMobile(value) {
    return String(value || "").replace(/\D/g, "").trim();
  }

  normalizeLocationScope(value) {
    return this.normalizeText(value).toUpperCase();
  }

  normalizeAssignedRoles(value) {
    const rawRoles = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(",")
        : [];

    return Array.from(
      new Set(
        rawRoles
          .map((role) => {
            const normalizedRole = this.normalizeText(role).toUpperCase();
            if (normalizedRole === "DEALING_OFFICER") return "PROCUREMENT_OFFICER";
            if (normalizedRole === "PROCUREMENT_ASSISTANT") return "ASSOCIATE";
            return normalizedRole;
          })
          .filter(Boolean),
      ),
    );
  }

  validateCreatePayload(payload = {}) {
    const empcode = this.normalizeText(payload.empcode);
    const employeeName = this.normalizeText(payload.employee_name);
    const mobileNo = this.normalizeMobile(payload.mobile_no);
    const designation = this.normalizeText(payload.designation);
    const assignedRoles = this.normalizeAssignedRoles(payload.assigned_roles);
    const division = this.normalizeText(payload.division || payload.department);
    const locationScope = this.normalizeLocationScope(payload.location_scope);

    if (!empcode) {
      const error = new Error("Employee code is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!employeeName) {
      const error = new Error("Employee name is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!/^[6-9]\d{9}$/.test(mobileNo)) {
      const error = new Error("Mobile number must be a valid 10 digit number.");
      error.statusCode = 400;
      throw error;
    }

    if (!designation) {
      const error = new Error("Designation is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!assignedRoles.length) {
      const error = new Error("At least one role must be assigned.");
      error.statusCode = 400;
      throw error;
    }

    if (!division) {
      const error = new Error("Division is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!locationScope) {
      const error = new Error("Location scope is required.");
      error.statusCode = 400;
      throw error;
    }

    return {
      empcode,
      employee_name: employeeName,
      mobile_no: mobileNo,
      designation,
      assigned_roles: assignedRoles,
      division,
      location_scope: locationScope,
      is_active: payload.is_active !== false,
    };
  }

  validateUpdatePayload(payload = {}, existingEmployee) {
    return {
      empcode: this.normalizeText(payload.empcode || existingEmployee?.empcode),
      employee_name: this.normalizeText(payload.employee_name || existingEmployee?.employee_name),
      mobile_no: this.normalizeMobile(payload.mobile_no || existingEmployee?.mobile_no),
      designation: this.normalizeText(payload.designation || existingEmployee?.designation),
      assigned_roles: this.normalizeAssignedRoles(
        payload.assigned_roles ?? existingEmployee?.assigned_roles,
      ),
      division: this.normalizeText(
        payload.division || payload.department || existingEmployee?.division || existingEmployee?.department,
      ),
      location_scope: this.normalizeLocationScope(payload.location_scope || existingEmployee?.location_scope),
      is_active:
        typeof payload.is_active === "boolean"
          ? payload.is_active
          : payload.is_active === "false"
            ? false
            : payload.is_active === "true"
              ? true
              : Boolean(existingEmployee?.is_active),
    };
  }

  serialize(employee) {
    return {
      id: employee.id,
      empcode: employee.empcode,
      employee_name: employee.employee_name,
      mobile_no: employee.mobile_no,
      designation: employee.designation,
      assigned_roles: this.normalizeAssignedRoles(employee.assigned_roles),
      division: employee.division || employee.department,
      location_scope: employee.location_scope,
      is_active: Boolean(employee.is_active),
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }

  async create(payload = {}) {
    const normalizedPayload = this.validateCreatePayload(payload);
    const existing = await this.repository.getByEmpcode(normalizedPayload.empcode);
    if (existing) {
      const error = new Error("A procurement employee already exists for this employee code.");
      error.statusCode = 409;
      throw error;
    }

    const employee = await this.repository.create(normalizedPayload);
    return this.serialize(employee);
  }

  async list(query = {}) {
    const filters = {
      activeOnly: String(query.activeOnly || "").toLowerCase() === "true",
      locationScope: query.location_scope,
      search: query.search,
    };
    const sortBy = normalizeSortBy(
      query.sortBy || query.sort_by,
      PROCUREMENT_EMPLOYEE_SORT_FIELDS,
      "employee_name",
    );
    const sortDirection = normalizeSortDirection(query.sortDir || query.sort_dir, "ASC");

    if (isCursorMode(query)) {
      const limit = normalizeLimit(query.limit);
      const cursor = normalizeCursor(query.cursor);
      const rows = await this.repository.list({
        ...filters,
        limit: limit + 1,
        cursor,
        sortBy,
        sortDirection,
      });
      const response = buildCursorResponse(rows, limit, { sortBy, sortDirection });
      response.rows = response.rows.map((employee) => this.serialize(employee));
      return response;
    }

    const employees = await this.repository.list({
      ...filters,
      sortBy,
      sortDirection,
    });

    return employees.map((employee) => this.serialize(employee));
  }

  async getById(id) {
    const employee = await this.repository.getById(Number(id));
    if (!employee) {
      const error = new Error("Procurement employee not found.");
      error.statusCode = 404;
      throw error;
    }

    return this.serialize(employee);
  }

  async update(id, payload = {}) {
    const employee = await this.repository.getById(Number(id));
    if (!employee) {
      const error = new Error("Procurement employee not found.");
      error.statusCode = 404;
      throw error;
    }

    const normalizedPayload = this.validateUpdatePayload(payload, employee);

    if (!normalizedPayload.empcode) {
      const error = new Error("Employee code is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!normalizedPayload.employee_name) {
      const error = new Error("Employee name is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!/^[6-9]\d{9}$/.test(normalizedPayload.mobile_no)) {
      const error = new Error("Mobile number must be a valid 10 digit number.");
      error.statusCode = 400;
      throw error;
    }

    if (!normalizedPayload.designation) {
      const error = new Error("Designation is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!normalizedPayload.assigned_roles.length) {
      const error = new Error("At least one role must be assigned.");
      error.statusCode = 400;
      throw error;
    }

    if (!normalizedPayload.division) {
      const error = new Error("Division is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!normalizedPayload.location_scope) {
      const error = new Error("Location scope is required.");
      error.statusCode = 400;
      throw error;
    }

    const existing = await this.repository.getByEmpcode(normalizedPayload.empcode);
    if (existing && Number(existing.id) !== Number(employee.id)) {
      const error = new Error("A procurement employee already exists for this employee code.");
      error.statusCode = 409;
      throw error;
    }

    const updatedEmployee = await this.repository.update(employee, normalizedPayload);
    return this.serialize(updatedEmployee);
  }

  async validateActivationIdentity(payload = {}) {
    const empcode = this.normalizeText(payload.empcode);
    const mobileNo = this.normalizeMobile(payload.mobileno || payload.mobile_no);

    if (!empcode || !mobileNo) {
      const error = new Error("Employee code and registered mobile number are required.");
      error.statusCode = 400;
      throw error;
    }

    const employee = await this.repository.getByEmpcodeAndMobile(empcode, mobileNo);
    if (!employee) {
      const error = new Error("No active procurement employee record matches the provided details.");
      error.statusCode = 404;
      throw error;
    }

    if (!employee.is_active) {
      const error = new Error("This procurement employee record is inactive.");
      error.statusCode = 403;
      throw error;
    }

    return {
      eligible: true,
      employee: this.serialize(employee),
    };
  }
}

module.exports = ProcurementEmployeeService;
