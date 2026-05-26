const express = require("express");
const CommitteeController = require("../controllers/committee-controller");

const router = express.Router();

router.get("/", CommitteeController.list);
router.post("/", CommitteeController.create);
router.get("/reports/member-attendance", CommitteeController.memberAttendanceReport);
router.get("/:id", CommitteeController.getById);

module.exports = router;
