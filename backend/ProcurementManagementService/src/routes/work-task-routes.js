const express = require("express");
const WorkTaskController = require("../controllers/work-task-controller");

const router = express.Router();

router.get("/", WorkTaskController.list);
router.post("/", WorkTaskController.create);
router.get("/:id", WorkTaskController.getById);
router.post("/:id/comments", WorkTaskController.addComment);
router.post("/:id/return", WorkTaskController.returnTask);
router.patch("/:id/status/:status", WorkTaskController.updateStatus);

module.exports = router;
