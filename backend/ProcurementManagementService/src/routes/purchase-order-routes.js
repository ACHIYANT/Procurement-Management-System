const express = require("express");
const PurchaseOrderController = require("../controllers/purchase-order-controller");
const PbgController = require("../controllers/pbg-controller");

const router = express.Router();

router.get("/", PurchaseOrderController.list);
router.post("/", PurchaseOrderController.create);
router.get("/:id", PurchaseOrderController.getById);
router.patch("/:id", PurchaseOrderController.update);
router.post("/:poId/consignees", PurchaseOrderController.createConsignee);
router.post("/:poId/inspections", PurchaseOrderController.createInspection);
router.post("/:poId/deliveries", PurchaseOrderController.createDelivery);
router.post("/:poId/installations", PurchaseOrderController.createInstallation);
router.post("/:poId/seller-invoices", PurchaseOrderController.createSellerInvoice);
router.post("/:poId/purchase-invoices", PurchaseOrderController.createPurchaseInvoice);
router.post("/:poId/sale-invoices", PurchaseOrderController.createSaleInvoice);
router.post("/:poId/payments", PurchaseOrderController.createVendorPayment);
router.post("/:poId/pbg", PbgController.createForPurchaseOrder);

module.exports = router;
