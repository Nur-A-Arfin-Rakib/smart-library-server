import { Response } from "express";
import Notice from "../models/Notice";
import { AuthRequest } from "../middleware/authMiddleware";

// @route POST /api/admin/notices  { title, message }
export const createNotice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, message } = req.body;
    if (!title || !message) {
      res.status(400).json({ message: "title and message are required" });
      return;
    }
    const notice = await Notice.create({ title, message, postedBy: req.user!.id });
    res.status(201).json(notice);
  } catch (error) {
    res.status(500).json({ message: "Failed to post notice", error: (error as Error).message });
  }
};

// @route GET /api/notices  (any logged-in user)
export const listNotices = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notices = await Notice.find().sort({ createdAt: -1 }).limit(20);
    res.status(200).json(notices);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notices", error: (error as Error).message });
  }
};

// @route DELETE /api/admin/notices/:id
export const deleteNotice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notice.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Notice deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete notice", error: (error as Error).message });
  }
};
