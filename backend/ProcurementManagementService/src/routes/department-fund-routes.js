const express = require("express");
const DepartmentFundController = require("../controllers/department-fund-controller");

const router = express.Router();

router.get("/", DepartmentFundController.list);
router.post("/", DepartmentFundController.create);

module.exports = router;
