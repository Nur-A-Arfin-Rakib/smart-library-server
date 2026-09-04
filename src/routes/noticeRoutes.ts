import { Router } from "express";
import { listNotices } from "../controllers/noticeController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.get("/", protect, listNotices);

export default router;
