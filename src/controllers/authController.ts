import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User";
import { setTokenCookie } from "../utils/generateToken";
import { AuthRequest } from "../middleware/authMiddleware";

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

// @route  POST /api/auth/register
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, department } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ message: "Name, email and password are required" });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      res.status(409).json({ message: "An account with this email already exists" });
      return;
    }

    // Every new signup is a student by default.
    // Librarian/Admin accounts should be created by an existing Admin.
    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      department,
      role: "student",
    });

    setTokenCookie(res, user._id, user.role);

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: "Registration failed", error: (error as Error).message });
  }
};

// @route  POST /api/auth/login
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    setTokenCookie(res, user._id, user.role);

    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: (error as Error).message });
  }
};

// @route  POST /api/auth/logout
export const logoutUser = (_req: Request, res: Response): void => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logged out successfully" });
};

// @route  GET /api/auth/me
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      department: user.department,
      studentId: user.studentId,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch profile", error: (error as Error).message });
  }
};

// @route  PUT /api/auth/me  (profile settings: update name / avatar / password)
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id).select("+password");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const { name, avatarUrl, password, currentPassword } = req.body;

    if (name) user.name = name;
    if (avatarUrl) user.avatarUrl = avatarUrl;

    if (password) {
      if (!currentPassword || !(await user.comparePassword(currentPassword))) {
        res.status(401).json({ message: "Current password is incorrect" });
        return;
      }
      user.password = password; // will be re-hashed by pre-save hook
    }

    await user.save();

    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update profile", error: (error as Error).message });
  }
};

// @route  POST /api/auth/google  { idToken }
// Verifies a Google Identity Services ID token from the frontend, then
// finds or creates a matching user and logs them in the same way as
// email/password (JWT via HttpOnly cookie).
export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!googleClient) {
      res.status(503).json({
        message: "Google login isn't configured on this server yet (missing GOOGLE_CLIENT_ID)",
      });
      return;
    }

    const { idToken } = req.body;
    if (!idToken) {
      res.status(400).json({ message: "idToken is required" });
      return;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.email) {
      res.status(401).json({ message: "Could not verify Google account" });
      return;
    }

    const normalizedEmail = payload.email.trim().toLowerCase();

    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      user = await User.create({
        name: payload.name || normalizedEmail.split("@")[0],
        email: normalizedEmail,
        googleId: payload.sub,
        avatarUrl: payload.picture,
        role: "student",
        isVerified: true,
      });
    } else if (!user.googleId) {
      // An account with this email already exists (e.g. signed up with a
      // password) — link the Google identity to it instead of duplicating.
      user.googleId = payload.sub;
      await user.save();
    }

    setTokenCookie(res, user._id, user.role);

    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    });
  } catch (error) {
    res.status(401).json({ message: "Google login failed", error: (error as Error).message });
  }
};
