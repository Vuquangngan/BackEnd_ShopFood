const express = require("express");
const router = express.Router();

const couponController = require("../controllers/couponController");
const { authenticate, authorize } = require("../middlewares/authMiddleware");

router.get("/", couponController.getAll);
router.post("/validate", couponController.validate);
router.get("/code/:code", couponController.getByCode);
router.get("/:id", couponController.getById);
router.post("/", authenticate, authorize("admin", "staff"), couponController.create);
router.put("/:id", authenticate, authorize("admin", "staff"), couponController.update);
router.delete("/:id", authenticate, authorize("admin"), couponController.remove);

module.exports = router;