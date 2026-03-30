const express = require("express");

const dashboardController = require("../controllers/dashboardController");
const { authenticate, authorize } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(authenticate);
router.get("/admin/overview", authorize("admin", "staff"), dashboardController.getAdminOverview);

module.exports = router;
