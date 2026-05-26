const ProcurementEmployeeService = require("../services/procurement-employee-service");

const service = new ProcurementEmployeeService();

const list = async (req, res) => {
  try {
    const data = await service.list(req.query || {});
    return res.status(200).json({
      success: true,
      message: "Procurement employees fetched successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return res.status(Number(error.statusCode || 500)).json({
      success: false,
      message: error.message || "Unable to fetch procurement employees.",
      data: {},
      err: {},
    });
  }
};

const getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Procurement employee fetched successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return res.status(Number(error.statusCode || 500)).json({
      success: false,
      message: error.message || "Unable to fetch procurement employee.",
      data: {},
      err: {},
    });
  }
};

const create = async (req, res) => {
  try {
    const data = await service.create(req.body || {});
    return res.status(201).json({
      success: true,
      message: "Procurement employee created successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return res.status(Number(error.statusCode || 500)).json({
      success: false,
      message: error.message || "Unable to create procurement employee.",
      data: {},
      err: {},
    });
  }
};

const update = async (req, res) => {
  try {
    const data = await service.update(req.params.id, req.body || {});
    return res.status(200).json({
      success: true,
      message: "Procurement employee updated successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return res.status(Number(error.statusCode || 500)).json({
      success: false,
      message: error.message || "Unable to update procurement employee.",
      data: {},
      err: {},
    });
  }
};

const validateActivationIdentity = async (req, res) => {
  try {
    const data = await service.validateActivationIdentity(req.body || {});
    return res.status(200).json({
      success: true,
      message: "Procurement employee verified successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return res.status(Number(error.statusCode || 500)).json({
      success: false,
      message: error.message || "Unable to verify procurement employee.",
      data: {},
      err: {},
    });
  }
};

module.exports = {
  list,
  getById,
  create,
  update,
  validateActivationIdentity,
};
