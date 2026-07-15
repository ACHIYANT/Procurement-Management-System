const WorkTaskService = require("../services/work-task-service");

const service = new WorkTaskService();

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
  empcode:
    req.body?.actor_empcode ||
    req.body?.actor_emp_code ||
    req.headers["x-employee-code"] ||
    req.headers["x-empcode"] ||
    null,
  mobile_no:
    req.body?.actor_mobile_no ||
    req.body?.actor_mobileno ||
    req.headers["x-employee-mobile"] ||
    req.headers["x-mobile-no"] ||
    null,
  name:
    req.body?.actor_name ||
    req.headers["x-user-name"] ||
    req.headers["x-employee-name"] ||
    null,
  roles: parseRoles(req.body?.actor_roles || req.headers["x-user-roles"]),
});

const list = async (req, res) => {
  try {
    const data = await service.listTasks(req.query || {});
    return res.status(200).json({
      success: true,
      message: "Work tasks fetched successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to fetch work tasks.");
  }
};

const getById = async (req, res) => {
  try {
    const data = await service.getTaskById(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Work task fetched successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to fetch work task.");
  }
};

const create = async (req, res) => {
  try {
    const data = await service.createTask(req.body || {}, resolveActor(req));
    return res.status(201).json({
      success: true,
      message: "Work task created successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to create work task.");
  }
};

const updateTask = async (req, res) => {
  try {
    const data = await service.updateTask(req.params.id, req.body || {}, resolveActor(req));
    return res.status(200).json({
      success: true,
      message: "Work task updated successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to update work task.");
  }
};

const updateStatus = async (req, res) => {
  try {
    const data = await service.updateStatus(
      req.params.id,
      req.params.status,
      req.body || {},
      resolveActor(req),
    );
    return res.status(200).json({
      success: true,
      message: "Work task status updated successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to update work task status.");
  }
};

const returnTask = async (req, res) => {
  try {
    const data = await service.returnTask(req.params.id, req.body || {}, resolveActor(req));
    return res.status(200).json({
      success: true,
      message: "Work task returned with remarks.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to return work task.");
  }
};

const snoozeTask = async (req, res) => {
  try {
    const data = await service.snoozeTask(req.params.id, req.body || {}, resolveActor(req));
    return res.status(200).json({
      success: true,
      message: "Work task reminder snoozed successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to snooze work task.");
  }
};

const reassignTask = async (req, res) => {
  try {
    const data = await service.reassignTask(req.params.id, req.body || {}, resolveActor(req));
    return res.status(200).json({
      success: true,
      message: "Work task reassigned successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to reassign work task.");
  }
};

const addComment = async (req, res) => {
  try {
    const data = await service.addComment(req.params.id, req.body || {}, resolveActor(req));
    return res.status(201).json({
      success: true,
      message: "Work task comment added successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to add work task comment.");
  }
};

const addAttachment = async (req, res) => {
  try {
    const data = await service.addAttachment(req.params.id, req.body || {}, resolveActor(req));
    return res.status(201).json({
      success: true,
      message: "Work task attachment added successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to add work task attachment.");
  }
};

const syncSystemTasks = async (req, res) => {
  try {
    const data = await service.syncSystemTasks(resolveActor(req));
    return res.status(200).json({
      success: true,
      message: "System work tasks synced successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to sync system work tasks.");
  }
};

const escalateOverdueTasks = async (_req, res) => {
  try {
    const data = await service.escalateOverdueTasks();
    return res.status(200).json({
      success: true,
      message: "Overdue work tasks escalated successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to escalate overdue work tasks.");
  }
};

module.exports = {
  addAttachment,
  addComment,
  create,
  escalateOverdueTasks,
  getById,
  list,
  reassignTask,
  returnTask,
  snoozeTask,
  syncSystemTasks,
  updateTask,
  updateStatus,
};
