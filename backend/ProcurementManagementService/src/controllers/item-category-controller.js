const ItemCategoryService = require("../services/item-category-service");

const service = new ItemCategoryService();

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
    return res.status(200).json({ success: true, message: "Item categories fetched successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to fetch item categories.");
  }
};

const create = async (req, res) => {
  try {
    const data = await service.create(req.body || {});
    return res.status(201).json({ success: true, message: "Item category created successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to create item category.");
  }
};

const updateCategory = async (req, res) => {
  try {
    const data = await service.updateCategory(req.params.id, req.body || {});
    return res.status(200).json({ success: true, message: "Item category updated successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to update item category.");
  }
};

const addSubcategories = async (req, res) => {
  try {
    const data = await service.addSubcategories(req.params.id, req.body || {});
    return res.status(201).json({ success: true, message: "Item subcategories added successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to add item subcategories.");
  }
};

const updateSubcategory = async (req, res) => {
  try {
    const data = await service.updateSubcategory(req.params.id, req.body || {});
    return res.status(200).json({ success: true, message: "Item subcategory updated successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to update item subcategory.");
  }
};

module.exports = {
  list,
  create,
  updateCategory,
  addSubcategories,
  updateSubcategory,
};
