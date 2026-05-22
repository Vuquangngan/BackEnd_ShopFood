const express = require("express");

const chatController = require("../controllers/chatController");
const { authenticate } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(authenticate);

router.get("/conversations", chatController.getConversations);
router.post("/conversations", chatController.createOrGetConversation);
router.get("/conversations/:id", chatController.getConversationById);
router.get("/conversations/:id/messages", chatController.getMessages);
router.post("/conversations/:id/messages", chatController.sendMessage);
router.post("/conversations/:id/read", chatController.markAsRead);
router.patch("/conversations/:id/status", chatController.updateStatus);

module.exports = router;
