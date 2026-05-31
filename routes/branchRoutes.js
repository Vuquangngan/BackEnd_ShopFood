const express = require("express");
const router = express.Router();

const branchController = require("../controllers/branchController");
const { authenticate, authorize } = require("../middlewares/authMiddleware");

router.use(authenticate);
router.get("/", branchController.getBranches);
router.post("/", authorize("admin"), branchController.createBranch);
router.patch("/:key", authorize("admin"), branchController.updateBranch);
router.delete("/:key", authorize("admin"), branchController.deleteBranch);

module.exports = router;
