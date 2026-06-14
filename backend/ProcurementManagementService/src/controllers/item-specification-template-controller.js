const ItemSpecificationTemplateService = require("../services/item-specification-template-service");

const service = new ItemSpecificationTemplateService();

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
  roles: parseRoles(req.body?.actor_roles || req.headers["x-user-roles"]),
});

const list = async (req, res) => {
  try {
    const data = await service.list(req.query || {});
    return res.status(200).json({
      success: true,
      message: "Specification templates fetched successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to fetch specification templates.");
  }
};

const create = async (req, res) => {
  try {
    const data = await service.create(req.body || {}, resolveActor(req));
    return res.status(201).json({
      success: true,
      message: "Specification template created successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to create specification template.");
  }
};

const update = async (req, res) => {
  try {
    const data = await service.update(req.params.id, req.body || {}, resolveActor(req));
    return res.status(200).json({
      success: true,
      message: "Specification template updated successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to update specification template.");
  }
};

module.exports = {
  list,
  create,
  update,
};
