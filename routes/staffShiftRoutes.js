const express = require("express");
const router = express.Router();

const staffShiftController = require("../controllers/staffShiftController");
const { authenticate, authorize } = require("../middlewares/authMiddleware");

router.use(authenticate);
router.get("/schedule", staffShiftController.getSchedule);
router.post("/slots", authorize("admin"), staffShiftController.saveSlot);
router.patch("/slots/:id", authorize("admin"), staffShiftController.saveSlot);
router.delete("/slots/:id", authorize("admin"), staffShiftController.deleteSlot);
router.put("/assignments", authorize("admin"), staffShiftController.replaceAssignments);
router.post("/assignments/self", authorize("admin", "staff"), staffShiftController.selfRegister);
router.patch("/assignments/confirm", authorize("admin"), staffShiftController.confirmAssignments);
router.delete("/assignments", authorize("admin"), staffShiftController.removeAssignment);
router.put("/holidays", authorize("admin"), staffShiftController.saveHolidays);
router.post("/confirm-notification", authorize("admin"), staffShiftController.sendShiftConfirmationNotifications);

module.exports = router;
