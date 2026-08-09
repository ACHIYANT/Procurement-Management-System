const WorkPushService = require("../services/work-push-service");

const service = new WorkPushService();

const sendError = (res, error, fallbackMessage) =>
  res.status(Number(error.statusCode || 500)).json({
    success: false,
    message: error.message || fallbackMessage,
    data: {},
    err: {},
  });

const getPublicKey = async (_req, res) => {
  try {
    const data = service.getPublicKey();
    return res.status(200).json({
      success: true,
      message: "Work push public key fetched successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to fetch work push public key.");
  }
};

const subscribe = async (req, res) => {
  try {
    const data = await service.saveSubscription(req.body || {});
    return res.status(200).json({
      success: true,
      message: "Work push subscription saved successfully.",
      data: { id: data.id },
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to save work push subscription.");
  }
};

const unsubscribe = async (req, res) => {
  try {
    const data = await service.removeSubscription(req.body || {});
    return res.status(200).json({
      success: true,
      message: "Work push subscription removed successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to remove work push subscription.");
  }
};

const acknowledge = async (req, res) => {
  try {
    const data = await service.acknowledgeReminderDelivery(req.body || {});
    return res.status(200).json({
      success: true,
      message: "Work reminder delivery acknowledged successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return sendError(res, error, "Unable to acknowledge work reminder delivery.");
  }
};

module.exports = {
  acknowledge,
  getPublicKey,
  subscribe,
  unsubscribe,
};
