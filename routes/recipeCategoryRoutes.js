const express = require("express");
const router = express.Router();

const recipeCategoryController = require("../controllers/recipeCategoryController");
const { authenticate, authorize } = require("../middlewares/authMiddleware");

router.get("/", recipeCategoryController.getAll);
router.get("/:id", recipeCategoryController.getById);
router.post("/", authenticate, authorize("admin", "staff"), recipeCategoryController.create);
router.put("/:id", authenticate, authorize("admin", "staff"), recipeCategoryController.update);
router.delete("/:id", authenticate, authorize("admin"), recipeCategoryController.remove);

module.exports = router;
