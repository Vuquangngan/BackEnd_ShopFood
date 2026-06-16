const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/authMiddleware");
const WalletController = require("../controllers/walletController");

router.use(authenticate);

router.get("/balance", WalletController.getBalance);
router.get("/transfers", WalletController.getTransfers);
router.post("/transfer", WalletController.createTransfer);

module.exports = router;
