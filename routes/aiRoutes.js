const express = require("express");
const aiController = require("../controllers/aiController");
const { authenticate } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(authenticate);
router.post("/support", aiController.askSupport);

module.exports = router;
