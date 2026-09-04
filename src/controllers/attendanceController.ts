import { Response } from "express";
import crypto from "crypto";
import Otp from "../models/Otp";
import Attendance from "../models/Attendance";
import User from "../models/User";
import { AuthRequest } from "../middleware/authMiddleware";
import { sendEmail } from "../utils/email";

const OTP_EXPIRY_MINUTES = 5;

// @route POST /api/attendance/send-otp  { purpose: "entry" | "exit" }
// Emails the code via Gmail SMTP if configured; otherwise falls back to
// returning it directly in the response so local development still works
// without an email provider set up.
export const sendOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { purpose } = req.body as { purpose: "entry" | "exit" };
    if (!purpose) {
      res.status(400).json({ message: "purpose ('entry' or 'exit') is required" });
      return;
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await Otp.create({ student: req.user!.id, code, purpose, expiresAt });

    const student = await User.findById(req.user!.id);
    const emailConfigured = Boolean(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD);

    if (student && emailConfigured) {
      await sendEmail({
        to: student.email,
        subject: `Your library ${purpose} code: ${code}`,
        html: `<div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px;">
          <p>Hi ${student.name},</p>
          <p>Your one-time code for library ${purpose} is:</p>
          <p style="font-size:28px;font-weight:600;letter-spacing:4px;">${code}</p>
          <p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
        </div>`,
      });
    } else {
      console.log(`[DEV] OTP for user ${req.user!.id} (${purpose}): ${code}`);
    }

    res.status(200).json({
      message: emailConfigured ? "OTP sent to your registered email" : "OTP generated (email not configured — see devOnlyCode)",
      devOnlyCode: !emailConfigured ? code : undefined,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to send OTP", error: (error as Error).message });
  }
};

// @route POST /api/attendance/verify-otp  { code, purpose }
export const verifyOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code, purpose } = req.body as { code: string; purpose: "entry" | "exit" };

    const otp = await Otp.findOne({
      student: req.user!.id,
      code,
      purpose,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otp) {
      res.status(400).json({ message: "Invalid or expired OTP" });
      return;
    }

    otp.used = true;
    await otp.save();

    const attendance = await Attendance.create({ student: req.user!.id, type: purpose });

    res.status(200).json({ message: `Attendance marked (${purpose})`, attendance });
  } catch (error) {
    res.status(500).json({ message: "OTP verification failed", error: (error as Error).message });
  }
};

// @route GET /api/attendance/my
export const getMyAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const records = await Attendance.find({ student: req.user!.id }).sort({ createdAt: -1 }).limit(50);
    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch attendance", error: (error as Error).message });
  }
};
