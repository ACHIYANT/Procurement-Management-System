const express = require("express");
const EmpanelmentController = require("../controllers/empanelment-controller");

const router = express.Router();

router.get("/", EmpanelmentController.list);
router.post("/", EmpanelmentController.create);
router.get("/:id", EmpanelmentController.getById);
router.post("/:empanelmentId/extensions", EmpanelmentController.createExtension);

module.exports = router;
