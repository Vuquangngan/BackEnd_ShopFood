const express = require("express");
const router = express.Router();

const controller = require("../controllers/branchImportRequestController");
const { authenticate, authorize } = require("../middlewares/authMiddleware");

router.use(authenticate);
router.get("/", authorize("admin", "staff"), controller.list);
router.post("/", authorize("admin", "staff"), controller.create);
router.patch("/:id", authorize("admin", "staff"), controller.update);
router.patch("/:id/items/:productId", authorize("admin", "staff"), controller.updateItem);

module.exports = router;
