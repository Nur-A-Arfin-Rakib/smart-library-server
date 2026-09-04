import { Router } from "express";
import {
  manualCheckIn,
  returnBook,
  getDailySummary,
  markFinePaid,
} from "../controllers/librarianController";
import { protect } from "../middleware/authMiddleware";
import { authorize } from "../middleware/roleMiddleware";

const router = Router();

router.use(protect, authorize("librarian", "admin"));

router.patch("/bookings/:id/manual-checkin", manualCheckIn);
router.patch("/borrow/:recordId/return", returnBook);
router.patch("/borrow/:recordId/mark-fine-paid", markFinePaid);
router.get("/daily-summary", getDailySummary);

export default router;
