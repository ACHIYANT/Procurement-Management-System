const ProcurementCaseService = require("../services/procurement-case-service");

const service = new ProcurementCaseService();

const sendError = (res, error, fallbackMessage) =>
  res.status(Number(error.statusCode || 500)).json({
    success: false,
    message: error.message || fallbackMessage,
    data: {},
    err: {},
  });

const list = async (req, res) => {
  try {
    const data = await service.list(req.query || {});
    return res.status(200).json({
      success: true,
      message: "Procurement cases fetched successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to fetch procurement cases.");
  }
};

const getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Procurement case fetched successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to fetch procurement case.");
  }
};

const create = async (req, res) => {
  try {
    const data = await service.create(req.body || {});
    return res.status(201).json({
      success: true,
      message: "Procurement case created successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to create procurement case.");
  }
};

module.exports = {
  list,
  getById,
  create,
};
