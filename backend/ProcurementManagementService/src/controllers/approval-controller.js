const ApprovalService = require("../services/approval-service");

const service = new ApprovalService();

const sendError = (res, error, fallbackMessage) =>
  res.status(Number(error.statusCode || 500)).json({
    success: false,
    message: error.message || fallbackMessage,
    data: {},
    err: {},
  });

const parseRoles = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return String(value)
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);
  }
};

const resolveActor = (req) => ({
  employee_id: req.body?.actor_employee_id
    ? Number(req.body.actor_employee_id)
    : req.headers["x-employee-id"]
      ? Number(req.headers["x-employee-id"])
      : null,
  name:
    req.body?.actor_name ||
    req.headers["x-user-name"] ||
    req.headers["x-employee-name"] ||
    null,
  roles: parseRoles(req.body?.actor_roles || req.headers["x-user-roles"]),
});

const listWorkflows = async (req, res) => {
  try {
    const data = await service.listWorkflows(req.query || {});
    return res.status(200).json({
      success: true,
      message: "Approval workflows fetched successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to fetch approval workflows.");
  }
};

const createWorkflow = async (req, res) => {
  try {
    const data = await service.createWorkflow(req.body || {});
    return res.status(201).json({
      success: true,
      message: "Approval workflow saved successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to save approval workflow.");
  }
};

const updateWorkflow = async (req, res) => {
  try {
    const data = await service.updateWorkflow(req.params.id, req.body || {});
    return res.status(200).json({
      success: true,
      message: "Approval workflow updated successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to update approval workflow.");
  }
};

const listRequests = async (req, res) => {
  try {
    const data = await service.listRequests(req.query || {});
    return res.status(200).json({
      success: true,
      message: "Approval requests fetched successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to fetch approval requests.");
  }
};

const createRequest = async (req, res) => {
  try {
    const data = await service.createRequest(req.body || {}, resolveActor(req));
    return res.status(201).json({
      success: true,
      message: "Approval request created successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to create approval request.");
  }
};

const getRequestById = async (req, res) => {
  try {
    const data = await service.repository.findRequestById(req.params.id);
    if (!data) {
      const error = new Error("Approval request not found.");
      error.statusCode = 404;
      throw error;
    }
    return res.status(200).json({
      success: true,
      message: "Approval request fetched successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to fetch approval request.");
  }
};

const approveRequest = async (req, res) => {
  try {
    const data = await service.approveRequest(req.params.id, req.body || {}, resolveActor(req));
    return res.status(200).json({
      success: true,
      message: "Approval request approved successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to approve request.");
  }
};

const rejectRequest = async (req, res) => {
  try {
    const data = await service.rejectRequest(req.params.id, req.body || {}, resolveActor(req));
    return res.status(200).json({
      success: true,
      message: "Approval request rejected successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to reject request.");
  }
};

const markApplied = async (req, res) => {
  try {
    const data = await service.markApplied(req.params.id, req.body || {}, resolveActor(req));
    return res.status(200).json({
      success: true,
      message: "Approval request marked as applied.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to mark request as applied.");
  }
};

module.exports = {
  approveRequest,
  createRequest,
  createWorkflow,
  getRequestById,
  listRequests,
  listWorkflows,
  markApplied,
  rejectRequest,
  updateWorkflow,
};
