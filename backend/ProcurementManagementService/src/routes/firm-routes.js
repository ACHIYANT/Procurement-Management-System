const express = require("express");
const FirmController = require("../controllers/firm-controller");

const router = express.Router();

router.get("/", FirmController.list);
router.post("/", FirmController.create);

module.exports = router;
