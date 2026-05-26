const express = require("express");
const PbgController = require("../controllers/pbg-controller");

const router = express.Router();

router.get("/", PbgController.list);
router.get("/:id", PbgController.getById);
router.post("/", PbgController.create);
router.patch("/:id", PbgController.update);
router.post("/workflows", PbgController.createWorkflow);

module.exports = router;
