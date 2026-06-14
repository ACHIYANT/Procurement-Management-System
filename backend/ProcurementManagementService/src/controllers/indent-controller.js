const IndentService = require("../services/indent-service");

const service = new IndentService();

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
    return res.status(200).json({ success: true, message: "Indents fetched successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to fetch indents.");
  }
};

const getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id);
    return res.status(200).json({ success: true, message: "Indent fetched successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to fetch indent.");
  }
};

const create = async (req, res) => {
  try {
    const data = await service.create(req.body || {});
    return res.status(201).json({ success: true, message: "Indent created successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to create indent.");
  }
};

const update = async (req, res) => {
  try {
    const data = await service.update(req.params.id, req.body || {});
    return res.status(200).json({ success: true, message: "Indent updated successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to update indent.");
  }
};

const updateDocuments = async (req, res) => {
  try {
    const data = await service.updateDocuments(req.params.id, req.body || {});
    return res.status(200).json({ success: true, message: "Indent documents updated successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to update indent documents.");
  }
};

const addDocument = async (req, res) => {
  try {
    const data = await service.addDocument(req.params.id, req.body || {});
    return res.status(201).json({ success: true, message: "Indent document added successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to add indent document.");
  }
};

const getWorkQueue = async (req, res) => {
  try {
    const data = await service.getWorkQueue(req.query || {});
    return res.status(200).json({ success: true, message: "Indent work queue fetched successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to fetch indent work queue.");
  }
};

const assignItem = async (req, res) => {
  try {
    const data = await service.assignItem(req.params.itemId, req.body || {});
    return res.status(200).json({ success: true, message: "Indent item assigned successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to assign indent item.");
  }
};

const returnItem = async (req, res) => {
  try {
    const data = await service.returnItem(req.params.itemId, req.body || {});
    return res.status(200).json({ success: true, message: "Indent item returned successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to return indent item.");
  }
};

const updateEstimate = async (req, res) => {
  try {
    const data = await service.updateEstimate(req.params.itemId, req.body || {});
    return res.status(200).json({ success: true, message: "Indent item estimate updated successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to update indent item estimate.");
  }
};

module.exports = {
  list,
  getById,
  create,
  update,
  updateDocuments,
  addDocument,
  getWorkQueue,
  assignItem,
  returnItem,
  updateEstimate,
};
