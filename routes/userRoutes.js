const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const { authenticate, authorize } = require("../middlewares/authMiddleware");

router.use(authenticate);

router.get("/me", userController.getMe);
router.put("/me", userController.updateMe);
router.get("/me/addresses", userController.getMyAddresses);
router.post("/me/addresses", userController.createMyAddress);
router.put("/me/addresses/:addressId", userController.updateMyAddress);
router.delete("/me/addresses/:addressId", userController.deleteMyAddress);

router.get("/", authorize("admin", "staff"), userController.getAll);
router.post("/", authorize("admin", "staff"), userController.create);
router.get("/customers", authorize("admin", "staff"), userController.getCustomers);
router.get("/:id", authorize("admin", "staff"), userController.getById);
router.put("/:id", authorize("admin", "staff"), userController.update);
router.delete("/:id", authorize("admin"), userController.remove);

module.exports = router;
