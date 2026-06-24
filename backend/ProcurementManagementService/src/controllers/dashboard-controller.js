const DashboardService = require("../services/dashboard-service");

const service = new DashboardService();

const getSummary = async (req, res) => {
  try {
    const data = await service.getSummary(req.query || {});
    return res.status(200).json({
      success: true,
      message: "Dashboard summary fetched successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return res.status(Number(error.statusCode || 500)).json({
      success: false,
      message: error.message || "Unable to fetch dashboard summary.",
      data: {},
      err: {},
    });
  }
};

module.exports = {
  getSummary,
};
