const express = require("express");
const IndentController = require("../controllers/indent-controller");

const router = express.Router();

router.get("/work-queue", IndentController.getWorkQueue);
router.get("/", IndentController.list);
router.post("/", IndentController.create);
router.patch("/:id", IndentController.update);
router.patch("/:id/documents", IndentController.updateDocuments);
router.post("/:id/documents", IndentController.addDocument);
router.patch("/items/:itemId/assign", IndentController.assignItem);
router.patch("/items/:itemId/return", IndentController.returnItem);
router.patch("/items/:itemId/estimate", IndentController.updateEstimate);
router.get("/:id", IndentController.getById);

module.exports = router;
