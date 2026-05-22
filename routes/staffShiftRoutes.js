const express = require("express");
const router = express.Router();

const staffShiftController = require("../controllers/staffShiftController");
const { authenticate, authorize } = require("../middlewares/authMiddleware");

router.use(authenticate);
router.post("/confirm-notification", authorize("admin"), staffShiftController.sendShiftConfirmationNotifications);

module.exports = router;
