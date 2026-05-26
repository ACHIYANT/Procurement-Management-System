const DepartmentFundService = require("../services/department-fund-service");

const service = new DepartmentFundService();

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
      message: "Department fund entries fetched successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to fetch department fund entries.");
  }
};

const create = async (req, res) => {
  try {
    const data = await service.create(req.body || {});
    return res.status(201).json({
      success: true,
      message: "Department fund entry created successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to create department fund entry.");
  }
};

module.exports = {
  list,
  create,
};
