const EmpanelmentService = require("../services/empanelment-service");

const service = new EmpanelmentService();

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
      message: "Empanelments fetched successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to fetch empanelments.");
  }
};

const getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Empanelment fetched successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to fetch empanelment.");
  }
};

const create = async (req, res) => {
  try {
    const data = await service.create(req.body || {});
    return res.status(201).json({
      success: true,
      message: "Empanelment created successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to create empanelment.");
  }
};

const createExtension = async (req, res) => {
  try {
    const data = await service.createExtension(req.params.empanelmentId, req.body || {});
    return res.status(201).json({
      success: true,
      message: "Empanelment extension recorded successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to record empanelment extension.");
  }
};

module.exports = {
  list,
  getById,
  create,
  createExtension,
};
