const express = require("express");
const ProcurementCaseController = require("../controllers/procurement-case-controller");

const router = express.Router();

router.get("/", ProcurementCaseController.list);
router.post("/", ProcurementCaseController.create);
router.get("/:id", ProcurementCaseController.getById);
router.patch("/:id", ProcurementCaseController.update);

module.exports = router;
