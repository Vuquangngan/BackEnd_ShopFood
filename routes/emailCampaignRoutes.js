const express = require("express");
const router = express.Router();

const emailCampaignController = require("../controllers/emailCampaignController");
const { authenticate, authorize } = require("../middlewares/authMiddleware");

router.use(authenticate);

router.post("/send", authorize("admin", "staff"), emailCampaignController.send);

module.exports = router;
