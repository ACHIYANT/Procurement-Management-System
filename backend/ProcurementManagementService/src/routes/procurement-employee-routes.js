const express = require("express");
const ProcurementEmployeeController = require("../controllers/procurement-employee-controller");

const router = express.Router();

router.get("/", ProcurementEmployeeController.list);
router.post("/", ProcurementEmployeeController.create);
router.get("/:id", ProcurementEmployeeController.getById);
router.patch("/:id", ProcurementEmployeeController.update);
router.post(
  "/activation/validate",
  ProcurementEmployeeController.validateActivationIdentity,
);

module.exports = router;
