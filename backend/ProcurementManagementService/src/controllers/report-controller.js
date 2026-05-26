"use strict";

const ReportService = require("../services/report-service");

const service = new ReportService();

const getSummary = async (_req, res) => {
  try {
    const data = await service.getSummary();
    return res.status(200).json({
      success: true,
      message: "Reports fetched successfully.",
      data,
      err: {},
    });
  } catch (error) {
    return res.status(Number(error.statusCode || 500)).json({
      success: false,
      message: error.message || "Unable to fetch reports.",
      data: {},
      err: {},
    });
  }
};

module.exports = {
  getSummary,
};
