const express = require("express");
const accountActivationRoutes = require("./account-activation-routes");
const approvalRoutes = require("./approval-routes");
const fileController = require("../controllers/file-controller");
const { uploadSingleEncryptedFile } = require("../middlewares/upload-middleware");
const dashboardRoutes = require("./dashboard-routes");
const departmentFundRoutes = require("./department-fund-routes");
const committeeRoutes = require("./committee-routes");
const emdRoutes = require("./emd-routes");
const empanelmentRoutes = require("./empanelment-routes");
const firmRoutes = require("./firm-routes");
const indentRoutes = require("./indent-routes");
const itemCategoryRoutes = require("./item-category-routes");
const itemSpecificationTemplateRoutes = require("./item-specification-template-routes");
const governmentOrganizationRoutes = require("./government-organization-routes");
const pbgRoutes = require("./pbg-routes");
const procurementCaseRoutes = require("./procurement-case-routes");
const purchaseOrderRoutes = require("./purchase-order-routes");
const procurementEmployeeRoutes = require("./procurement-employee-routes");
const reportRoutes = require("./report-routes");
const tenderRoutes = require("./tender-routes");
const workPushRoutes = require("./work-push-routes");
const workTaskRoutes = require("./work-task-routes");

const router = express.Router();

router.get("/healthz", (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "Procurement management service healthy",
    data: {},
    err: {},
  });
});

router.use("/account-activation", accountActivationRoutes);
router.use("/approvals", approvalRoutes);
router.post("/files/upload/:scope", uploadSingleEncryptedFile, fileController.uploadEncryptedFile);
router.get("/files/view", fileController.viewStoredFile);
router.get("/files/download", fileController.downloadStoredFile);

router.use("/dashboard", dashboardRoutes);
router.use("/department-funds", departmentFundRoutes);
router.use("/committees", committeeRoutes);
router.use("/indents", indentRoutes);
router.use("/item-categories", itemCategoryRoutes);
router.use("/item-specification-templates", itemSpecificationTemplateRoutes);
router.use("/government-organizations", governmentOrganizationRoutes);
router.use("/procurement-cases", procurementCaseRoutes);
router.use("/firms", firmRoutes);
router.use("/empanelments", empanelmentRoutes);
router.use("/emd", emdRoutes);
router.use("/pbg", pbgRoutes);
router.use("/purchase-orders", purchaseOrderRoutes);
router.use("/tenders", tenderRoutes);
router.use("/procurement-employees", procurementEmployeeRoutes);
router.use("/reports", reportRoutes);
router.use("/work-push", workPushRoutes);
router.use("/work-tasks", workTaskRoutes);

module.exports = router;
