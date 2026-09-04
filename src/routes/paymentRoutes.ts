import { Router } from "express";
import { createCheckoutSession } from "../controllers/paymentController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.post("/checkout-session/:recordId", protect, createCheckoutSession);

export default router;
