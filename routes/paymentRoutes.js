const express = require("express");

const paymentController = require("../controllers/paymentController");

const router = express.Router();

router.get("/checkout/:token", paymentController.renderCheckoutPage);
router.get("/:token", paymentController.getByToken);
router.post("/:token/confirm", paymentController.confirm);
router.post("/:token/cancel", paymentController.cancel);

module.exports = router;