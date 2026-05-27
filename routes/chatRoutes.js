const express = require("express");

const chatController = require("../controllers/chatController");
const aiController = require("../controllers/aiController");
const { authenticate } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(authenticate);

router.post("/ai-support", aiController.askSupport);
router.get("/conversations", chatController.getConversations);
router.post("/conversations", chatController.createOrGetConversation);
router.get("/conversations/:id", chatController.getConversationById);
router.get("/conversations/:id/messages", chatController.getMessages);
router.post("/conversations/:id/messages", chatController.sendMessage);
router.post("/conversations/:id/read", chatController.markAsRead);
router.patch("/conversations/:id/status", chatController.updateStatus);

module.exports = router;
