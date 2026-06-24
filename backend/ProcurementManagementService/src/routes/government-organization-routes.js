"use strict";

const express = require("express");
const GovernmentOrganizationController = require("../controllers/government-organization-controller");

const router = express.Router();

router.get("/", GovernmentOrganizationController.list);
router.post("/", GovernmentOrganizationController.create);
router.patch("/:id", GovernmentOrganizationController.update);

module.exports = router;
