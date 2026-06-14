const express = require("express");
const WorkTaskController = require("../controllers/work-task-controller");

const router = express.Router();

router.get("/", WorkTaskController.list);
router.post("/", WorkTaskController.create);
router.post("/escalate-overdue", WorkTaskController.escalateOverdueTasks);
router.post("/sync-system", WorkTaskController.syncSystemTasks);
router.get("/:id", WorkTaskController.getById);
router.patch("/:id", WorkTaskController.updateTask);
router.post("/:id/attachments", WorkTaskController.addAttachment);
router.post("/:id/comments", WorkTaskController.addComment);
router.post("/:id/reassign", WorkTaskController.reassignTask);
router.post("/:id/return", WorkTaskController.returnTask);
router.post("/:id/snooze", WorkTaskController.snoozeTask);
router.patch("/:id/status/:status", WorkTaskController.updateStatus);

module.exports = router;
