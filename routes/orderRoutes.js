const express = require("express");
const router = express.Router();

const orderController = require("../controllers/orderController");
const { authenticate, authorize } = require("../middlewares/authMiddleware");

router.use(authenticate);

router.get("/my-orders", orderController.getMine);
router.get("/", authorize("admin", "staff"), orderController.getAll);
router.post("/", orderController.create);
router.get("/:id/payments", orderController.getPayments);
router.post("/:id/payment-link", orderController.createPaymentLink);
router.post("/:id/shipping/grab-dev", authorize("admin", "staff"), orderController.createGrabDevShipment);
router.put("/:id/shipping/grab-dev", authorize("admin", "staff"), orderController.updateGrabDevShipment);
router.get("/:id", orderController.getById);
router.put("/:id/status", orderController.updateStatus);
router.delete("/:id", authorize("admin"), orderController.remove);

module.exports = router;
