const express = require("express");
const router = express.Router();

const recipeController = require("../controllers/recipeController");
const { authenticate, authorize } = require("../middlewares/authMiddleware");

router.get("/", recipeController.getAll);
router.get("/:id", recipeController.getById);
router.post("/", authenticate, authorize("admin", "staff"), recipeController.create);
router.put("/:id", authenticate, authorize("admin", "staff"), recipeController.update);
router.post("/:id/favorite", authenticate, recipeController.toggleFavorite);
router.post("/:id/reviews", authenticate, recipeController.upsertReview);
router.delete("/:id/reviews", authenticate, recipeController.removeReview);
router.delete("/:id", authenticate, authorize("admin"), recipeController.remove);

module.exports = router;