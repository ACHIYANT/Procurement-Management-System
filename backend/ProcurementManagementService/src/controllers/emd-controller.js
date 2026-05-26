const EmdService = require("../services/emd-service");

const service = new EmdService();

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
    return res.status(200).json({ success: true, message: "EMD entries fetched successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to fetch EMD entries.");
  }
};

const getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id);
    return res.status(200).json({ success: true, message: "EMD entry fetched successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to fetch EMD entry.");
  }
};

const create = async (req, res) => {
  try {
    const data = await service.create(req.body || {});
    return res.status(201).json({ success: true, message: "EMD entry created successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to create EMD entry.");
  }
};

const update = async (req, res) => {
  try {
    const data = await service.update(req.params.id, req.body || {});
    return res.status(200).json({ success: true, message: "EMD entry updated successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to update EMD entry.");
  }
};

const createWorkflow = async (req, res) => {
  try {
    const data = await service.createWorkflow(req.body || {});
    return res.status(201).json({ success: true, message: "EMD workflow created successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to create EMD workflow.");
  }
};

module.exports = { list, getById, create, update, createWorkflow };
