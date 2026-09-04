import { Router } from "express";
import { sendOtp, verifyOtp, getMyAttendance } from "../controllers/attendanceController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.post("/send-otp", protect, sendOtp);
router.post("/verify-otp", protect, verifyOtp);
router.get("/my", protect, getMyAttendance);

export default router;
