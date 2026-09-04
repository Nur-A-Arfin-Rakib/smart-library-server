import { Router } from "express";
import {
  getZonesWithAvailability,
  createBooking,
  getMyBookings,
  checkInBooking,
  cancelBooking,
} from "../controllers/bookingController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.get("/zones", protect, getZonesWithAvailability);
router.post("/", protect, createBooking);
router.get("/my", protect, getMyBookings);
router.post("/checkin/:qrToken", protect, checkInBooking);
router.patch("/:id/cancel", protect, cancelBooking);

export default router;
