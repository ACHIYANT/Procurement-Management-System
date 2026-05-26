const express = require("express");
const EmdController = require("../controllers/emd-controller");

const router = express.Router();

router.get("/", EmdController.list);
router.get("/:id", EmdController.getById);
router.post("/", EmdController.create);
router.patch("/:id", EmdController.update);
router.post("/workflows", EmdController.createWorkflow);

module.exports = router;
