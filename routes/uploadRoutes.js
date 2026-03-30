const express = require("express");

const { authenticate, authorize } = require("../middlewares/authMiddleware");
const { uploadImageFields } = require("../middlewares/uploadMiddleware");
const uploadController = require("../controllers/uploadController");

const router = express.Router();

router.post("/images", authenticate, authorize("admin", "staff"), uploadImageFields, uploadController.uploadImages);

module.exports = router;