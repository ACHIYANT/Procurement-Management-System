const express = require("express");
const TenderController = require("../controllers/tender-controller");

const router = express.Router();

router.get("/", TenderController.list);
router.post("/", TenderController.create);
router.get("/:id", TenderController.getById);
router.patch("/:tenderId/pbg-setup", TenderController.updatePbgSetup);
router.post("/:tenderId/submission-extensions", TenderController.createSubmissionExtension);
router.post("/:tenderId/vendors", TenderController.addVendor);
router.patch("/:tenderId/vendors/:vendorId", TenderController.updateVendor);
router.post("/:tenderId/vendors/:vendorId/allocation-extensions", TenderController.createVendorAllocationExtension);
router.delete("/:tenderId/vendors/:vendorId", TenderController.deleteVendor);
router.post("/:tenderId/emd/generate", TenderController.generateEmdEntries);

module.exports = router;
