const express = require("express");
const router = express.Router();

const productController = require("../controllers/productController");
const { authenticate, authorize, optionalAuthenticate } = require("../middlewares/authMiddleware");

router.get("/", optionalAuthenticate, productController.getAll);
router.get("/:id/reviews", optionalAuthenticate, productController.getReviews);
router.post("/:id/reviews", authenticate, productController.submitReview);
router.get("/:id", optionalAuthenticate, productController.getById);
router.post("/", authenticate, authorize("admin", "staff"), productController.create);
router.put("/:id", authenticate, authorize("admin", "staff"), productController.update);
router.patch("/:id/publish", authenticate, authorize("admin", "staff"), productController.publish);
router.patch("/:id/unpublish", authenticate, authorize("admin", "staff"), productController.unpublish);
router.delete("/:id", authenticate, authorize("admin"), productController.remove);

module.exports = router;
