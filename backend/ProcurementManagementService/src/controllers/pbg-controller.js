const PbgService = require("../services/pbg-service");

const service = new PbgService();

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
    return res.status(200).json({ success: true, message: "PBG entries fetched successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to fetch PBG entries.");
  }
};

const getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id);
    return res.status(200).json({ success: true, message: "PBG entry fetched successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to fetch PBG entry.");
  }
};

const create = async (req, res) => {
  try {
    const data = await service.create(req.body || {});
    return res.status(201).json({ success: true, message: "PBG entry created successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to create PBG entry.");
  }
};

const createForPurchaseOrder = async (req, res) => {
  try {
    const data = await service.createForPurchaseOrder(req.params.poId, req.body || {});
    return res.status(201).json({ success: true, message: "PO-linked PBG entry created successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to create PO-linked PBG entry.");
  }
};

const update = async (req, res) => {
  try {
    const data = await service.update(req.params.id, req.body || {});
    return res.status(200).json({ success: true, message: "PBG entry updated successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to update PBG entry.");
  }
};

const createWorkflow = async (req, res) => {
  try {
    const data = await service.createWorkflow(req.body || {});
    return res.status(201).json({ success: true, message: "PBG workflow created successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to create PBG workflow.");
  }
};

module.exports = { list, getById, create, createForPurchaseOrder, update, createWorkflow };
