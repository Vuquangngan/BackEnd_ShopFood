const express = require("express");

const notificationController = require("../controllers/notificationController");
const { authenticate } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(authenticate);
router.get("/", notificationController.getMyNotifications);
router.get("/unread-count", notificationController.getUnreadCount);
router.post("/read-all", notificationController.markAllAsRead);
router.post("/:id/read", notificationController.markAsRead);

module.exports = router;
