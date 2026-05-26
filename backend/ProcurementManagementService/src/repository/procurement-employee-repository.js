const { Op } = require("sequelize");
const { ProcurementEmployee } = require("../../models");
const { buildCursorWhere, buildSortOrder } = require("../utils/procurement-domain");

class ProcurementEmployeeRepository {
  async create(payload) {
    return ProcurementEmployee.create(payload);
  }

  async update(instance, payload) {
    return instance.update(payload);
  }

  async list(filters = {}) {
    const where = {};

    if (filters.activeOnly) {
      where.is_active = true;
    }

    if (String(filters.locationScope || "").trim()) {
      where.location_scope = String(filters.locationScope).trim().toUpperCase();
    }

    if (String(filters.search || "").trim()) {
      const search = `%${String(filters.search).trim()}%`;
      where[Op.or] = [
        { employee_name: { [Op.like]: search } },
        { empcode: { [Op.like]: search } },
        { mobile_no: { [Op.like]: search } },
        { division: { [Op.like]: search } },
        { designation: { [Op.like]: search } },
      ];
    }

    return ProcurementEmployee.findAll({
      where: buildCursorWhere({
        baseWhere: where,
        cursor: filters.cursor,
        sortBy: filters.sortBy || "employee_name",
        sortDirection: filters.sortDirection || "ASC",
      }),
      order: buildSortOrder(
        filters.sortBy || "employee_name",
        filters.sortDirection || "ASC",
      ),
      ...(filters.limit ? { limit: filters.limit } : {}),
    });
  }

  async getById(id) {
    return ProcurementEmployee.findByPk(id);
  }

  async getByEmpcode(empcode) {
    return ProcurementEmployee.findOne({
      where: {
        empcode: String(empcode || "").trim(),
      },
    });
  }

  async getByEmpcodeAndMobile(empcode, mobileNo) {
    return ProcurementEmployee.findOne({
      where: {
        empcode: String(empcode || "").trim(),
        mobile_no: String(mobileNo || "").trim(),
      },
    });
  }
}

module.exports = ProcurementEmployeeRepository;
