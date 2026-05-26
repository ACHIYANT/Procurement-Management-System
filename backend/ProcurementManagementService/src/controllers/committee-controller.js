const CommitteeService = require("../services/committee-service");

const service = new CommitteeService();

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
    return res.status(200).json({ success: true, message: "Committee meetings fetched successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to fetch committee meetings.");
  }
};

const getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id);
    return res.status(200).json({ success: true, message: "Committee meeting fetched successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to fetch committee meeting.");
  }
};

const create = async (req, res) => {
  try {
    const data = await service.create(req.body || {});
    return res.status(201).json({ success: true, message: "Committee meeting created successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to create committee meeting.");
  }
};

const memberAttendanceReport = async (req, res) => {
  try {
    const data = await service.memberAttendanceReport(req.query || {});
    return res.status(200).json({ success: true, message: "Committee member attendance report fetched successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to fetch member attendance report.");
  }
};

module.exports = {
  list,
  getById,
  create,
  memberAttendanceReport,
};
