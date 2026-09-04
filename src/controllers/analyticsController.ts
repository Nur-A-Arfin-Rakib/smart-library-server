import { Response } from "express";
import User from "../models/User";
import Book from "../models/Book";
import Zone from "../models/Zone";
import Booking from "../models/Booking";
import BorrowRecord from "../models/BorrowRecord";
import { AuthRequest } from "../middleware/authMiddleware";

// @route GET /api/admin/analytics/overview
export const getOverview = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [totalStudents, totalBooks, totalZones, activeBorrows, pendingFineAgg] =
      await Promise.all([
        User.countDocuments({ role: "student" }),
        Book.countDocuments(),
        Zone.countDocuments(),
        BorrowRecord.countDocuments({ status: { $in: ["borrowed", "overdue"] } }),
        BorrowRecord.aggregate([
          { $match: { finePaid: false } },
          { $group: { _id: null, total: { $sum: "$fine" } } },
        ]),
      ]);

    res.status(200).json({
      totalStudents,
      totalBooks,
      totalZones,
      activeBorrows,
      pendingFineTotal: pendingFineAgg[0]?.total || 0,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to build overview", error: (error as Error).message });
  }
};

// @route GET /api/admin/analytics/occupancy-trend
// Returns booking counts for the last 7 days — feeds a line/bar chart.
export const getOccupancyTrend = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const days: { date: string; bookings: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const count = await Booking.countDocuments({
        createdAt: { $gte: dayStart, $lte: dayEnd },
      });

      days.push({ date: dayStart.toLocaleDateString("en-US", { weekday: "short" }), bookings: count });
    }

    res.status(200).json(days);
  } catch (error) {
    res.status(500).json({ message: "Failed to build trend", error: (error as Error).message });
  }
};

// @route GET /api/admin/analytics/popular-zones
export const getPopularZones = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const results = await Booking.aggregate([
      { $group: { _id: "$zone", bookings: { $sum: 1 } } },
      { $sort: { bookings: -1 } },
      { $limit: 5 },
      {
        $lookup: { from: "zones", localField: "_id", foreignField: "_id", as: "zone" },
      },
      { $unwind: "$zone" },
      { $project: { name: "$zone.name", bookings: 1, _id: 0 } },
    ]);

    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to build popular zones", error: (error as Error).message });
  }
};
