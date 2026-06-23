const TenderService = require("../services/tender-service");

const service = new TenderService();

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
    return res.status(200).json({ success: true, message: "Tenders fetched successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to fetch tenders.");
  }
};

const getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id);
    return res.status(200).json({ success: true, message: "Tender fetched successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to fetch tender.");
  }
};

const create = async (req, res) => {
  try {
    const data = await service.create(req.body || {});
    return res.status(201).json({ success: true, message: "Tender created successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to create tender.");
  }
};

const update = async (req, res) => {
  try {
    const data = await service.update(req.params.id, req.body || {});
    return res.status(200).json({ success: true, message: "Tender updated successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to update tender.");
  }
};

const createSubmissionExtension = async (req, res) => {
  try {
    const data = await service.createSubmissionExtension(req.params.tenderId, req.body || {});
    return res.status(201).json({
      success: true,
      message: "Tender submission extension recorded successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to record tender submission extension.");
  }
};

const addVendor = async (req, res) => {
  try {
    const data = await service.addVendor(req.params.tenderId, req.body || {});
    return res.status(201).json({ success: true, message: "Tender vendor added successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to add tender vendor.");
  }
};

const updateVendor = async (req, res) => {
  try {
    const data = await service.updateVendor(req.params.tenderId, req.params.vendorId, req.body || {});
    return res.status(200).json({ success: true, message: "Tender vendor updated successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to update tender vendor.");
  }
};

const updatePbgSetup = async (req, res) => {
  try {
    const data = await service.updatePbgSetup(req.params.tenderId, req.body || {});
    return res.status(200).json({
      success: true,
      message: "Tender PBG setup updated successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to update tender PBG setup.");
  }
};

const createVendorAllocationExtension = async (req, res) => {
  try {
    const data = await service.createVendorAllocationExtension(
      req.params.tenderId,
      req.params.vendorId,
      req.body || {},
    );
    return res.status(201).json({
      success: true,
      message: "Vendor allocation extension recorded successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to record vendor allocation extension.");
  }
};

const deleteVendor = async (req, res) => {
  try {
    const data = await service.deleteVendor(req.params.tenderId, req.params.vendorId);
    return res.status(200).json({ success: true, message: "Tender vendor deleted successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to delete tender vendor.");
  }
};

const generateEmdEntries = async (req, res) => {
  try {
    const data = await service.generateEmdEntries(req.params.tenderId);
    return res.status(201).json({
      success: true,
      message: "Tender EMD records generated successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to generate tender EMD records.");
  }
};

module.exports = {
  list,
  getById,
  create,
  update,
  createSubmissionExtension,
  addVendor,
  updateVendor,
  updatePbgSetup,
  createVendorAllocationExtension,
  deleteVendor,
  generateEmdEntries,
};
