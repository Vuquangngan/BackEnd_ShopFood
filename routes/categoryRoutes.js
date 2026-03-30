const express = require("express");
const router = express.Router();

const categoryController = require("../controllers/categoryController");
const { authenticate, authorize } = require("../middlewares/authMiddleware");

router.get("/", categoryController.getAll);
router.get("/:id", categoryController.getById);
router.post("/", authenticate, authorize("admin", "staff"), categoryController.create);
router.put("/:id", authenticate, authorize("admin", "staff"), categoryController.update);
router.delete("/:id", authenticate, authorize("admin"), categoryController.remove);

module.exports = router;