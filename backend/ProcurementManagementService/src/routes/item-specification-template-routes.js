const express = require("express");
const ItemSpecificationTemplateController = require("../controllers/item-specification-template-controller");

const router = express.Router();

router.get("/", ItemSpecificationTemplateController.list);
router.post("/", ItemSpecificationTemplateController.create);
router.patch("/:id", ItemSpecificationTemplateController.update);

module.exports = router;
