const PurchaseOrderService = require("../services/purchase-order-service");

const service = new PurchaseOrderService();

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
    return res.status(200).json({ success: true, message: "Purchase orders fetched successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to fetch purchase orders.");
  }
};

const getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id);
    return res.status(200).json({ success: true, message: "Purchase order fetched successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to fetch purchase order.");
  }
};

const create = async (req, res) => {
  try {
    const data = await service.create(req.body || {});
    return res.status(201).json({ success: true, message: "Purchase order created successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to create purchase order.");
  }
};

const update = async (req, res) => {
  try {
    const data = await service.update(req.params.id, req.body || {});
    return res.status(200).json({
      success: true,
      message: "Purchase order updated successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to update purchase order.");
  }
};

const createVendorPayment = async (req, res) => {
  try {
    const data = await service.createVendorPayment(req.params.poId, req.body || {});
    return res.status(201).json({
      success: true,
      message: "Vendor payment recorded successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to record vendor payment.");
  }
};

const createConsignee = async (req, res) => {
  try {
    const data = await service.createConsignee(req.params.poId, req.body || {});
    return res.status(201).json({ success: true, message: "Consignee saved successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to save consignee.");
  }
};

const createInspection = async (req, res) => {
  try {
    const data = await service.createInspection(req.params.poId, req.body || {});
    return res.status(201).json({ success: true, message: "Inspection saved successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to save inspection.");
  }
};

const createDelivery = async (req, res) => {
  try {
    const data = await service.createDelivery(req.params.poId, req.body || {});
    return res.status(201).json({ success: true, message: "Delivery saved successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to save delivery.");
  }
};

const createInstallation = async (req, res) => {
  try {
    const data = await service.createInstallation(req.params.poId, req.body || {});
    return res.status(201).json({ success: true, message: "Installation saved successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to save installation.");
  }
};

const createSellerInvoice = async (req, res) => {
  try {
    const data = await service.createSellerInvoice(req.params.poId, req.body || {});
    return res.status(201).json({ success: true, message: "Seller invoice saved successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to save seller invoice.");
  }
};

const createPurchaseInvoice = async (req, res) => {
  try {
    const data = await service.createPurchaseInvoice(req.params.poId, req.body || {});
    return res.status(201).json({ success: true, message: "Purchase invoice booked successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to book purchase invoice.");
  }
};

const createSaleInvoice = async (req, res) => {
  try {
    const data = await service.createSaleInvoice(req.params.poId, req.body || {});
    return res.status(201).json({ success: true, message: "Sale invoice saved successfully.", data, err: {} });
  } catch (error) {
    return sendError(res, error, "Unable to save sale invoice.");
  }
};

module.exports = {
  list,
  getById,
  create,
  update,
  createVendorPayment,
  createConsignee,
  createInspection,
  createDelivery,
  createInstallation,
  createSellerInvoice,
  createPurchaseInvoice,
  createSaleInvoice,
};
