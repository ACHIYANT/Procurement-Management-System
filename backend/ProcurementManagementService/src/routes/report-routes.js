"use strict";

const express = require("express");
const ReportController = require("../controllers/report-controller");

const router = express.Router();

router.get("/", ReportController.getSummary);

module.exports = router;
