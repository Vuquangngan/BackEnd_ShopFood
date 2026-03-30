const express = require("express");
const router = express.Router();

const inventoryController = require("../controllers/inventoryController");
const { authenticate, authorize } = require("../middlewares/authMiddleware");

router.use(authenticate, authorize("admin", "staff"));

router.get("/suppliers", inventoryController.getSuppliers);
router.post("/suppliers", inventoryController.createSupplier);
router.get("/suppliers/:id", inventoryController.getSupplierById);
router.put("/suppliers/:id", inventoryController.updateSupplier);
router.delete("/suppliers/:id", authorize("admin"), inventoryController.removeSupplier);

router.get("/documents", inventoryController.getDocuments);
router.post("/documents", inventoryController.createDocument);
router.get("/documents/:id", inventoryController.getDocumentById);
router.post("/documents/:id/complete", inventoryController.completeDocument);
router.post("/documents/:id/cancel", inventoryController.cancelDocument);

router.get("/transactions", inventoryController.getTransactions);

module.exports = router;
