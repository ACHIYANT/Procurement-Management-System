const express = require("express");
const ApprovalController = require("../controllers/approval-controller");

const router = express.Router();

router.get("/workflows", ApprovalController.listWorkflows);
router.post("/workflows", ApprovalController.createWorkflow);
router.put("/workflows/:id", ApprovalController.updateWorkflow);
router.get("/requests", ApprovalController.listRequests);
router.post("/requests", ApprovalController.createRequest);
router.get("/requests/:id", ApprovalController.getRequestById);
router.post("/requests/:id/approve", ApprovalController.approveRequest);
router.post("/requests/:id/reject", ApprovalController.rejectRequest);
router.post("/requests/:id/mark-applied", ApprovalController.markApplied);

module.exports = router;
