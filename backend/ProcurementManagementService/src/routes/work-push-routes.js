const express = require("express");
const WorkPushController = require("../controllers/work-push-controller");

const router = express.Router();

router.get("/public-key", WorkPushController.getPublicKey);
router.post("/subscribe", WorkPushController.subscribe);
router.post("/unsubscribe", WorkPushController.unsubscribe);

module.exports = router;
