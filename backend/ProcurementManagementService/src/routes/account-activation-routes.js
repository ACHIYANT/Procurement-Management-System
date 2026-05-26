const express = require("express");
const AccountActivationController = require("../controllers/account-activation-controller");

const router = express.Router();

router.post("/validate", AccountActivationController.validateActivation);
router.post("/execute", AccountActivationController.executeActivation);

module.exports = router;
