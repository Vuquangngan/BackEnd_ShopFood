const express = require("express");
const router = express.Router();

const promotionController = require("../controllers/promotionController");
const { authenticate, authorize } = require("../middlewares/authMiddleware");

router.get("/", promotionController.list);
router.get("/:id", promotionController.getById);
router.post("/", authenticate, authorize("admin", "staff"), promotionController.create);
router.put("/:id", authenticate, authorize("admin", "staff"), promotionController.update);
router.delete("/:id", authenticate, authorize("admin"), promotionController.remove);

module.exports = router;
