const express = require("express");

const { authenticate } = require("../middlewares/authMiddleware");
const { uploadImageFields } = require("../middlewares/uploadMiddleware");
const uploadController = require("../controllers/uploadController");

const router = express.Router();

router.get("/assets/:id", uploadController.getAsset);
router.post("/images", authenticate, uploadImageFields, uploadController.uploadImages);

module.exports = router;
