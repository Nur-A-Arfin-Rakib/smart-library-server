import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  getProfile,
  updateProfile,
  googleLogin,
} from "../controllers/authController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/google", googleLogin);
router.post("/logout", logoutUser);
router.get("/me", protect, getProfile);
router.put("/me", protect, updateProfile);

export default router;
