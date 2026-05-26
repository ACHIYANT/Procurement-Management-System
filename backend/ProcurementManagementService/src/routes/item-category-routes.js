const express = require("express");
const ItemCategoryController = require("../controllers/item-category-controller");

const router = express.Router();

router.get("/", ItemCategoryController.list);
router.post("/", ItemCategoryController.create);
router.patch("/:id", ItemCategoryController.updateCategory);
router.post("/:id/subcategories", ItemCategoryController.addSubcategories);
router.patch("/subcategories/:id", ItemCategoryController.updateSubcategory);

module.exports = router;
