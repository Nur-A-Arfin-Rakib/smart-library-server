import { Response } from "express";
import { isValidObjectId } from "mongoose";
import Booking from "../models/Booking";
import BorrowRecord from "../models/BorrowRecord";
import Book from "../models/Book";
import User from "../models/User";
import Attendance from "../models/Attendance";
import Reservation from "../models/Reservation";
import { AuthRequest } from "../middleware/authMiddleware";
import { calculateFine } from "../utils/fine";
import { sendEmail, returnConfirmationEmail } from "../utils/email";

// @route PATCH /api/librarian/bookings/:id/manual-checkin
// Used when a student can't scan their own QR code.
export const manualCheckIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: "That doesn't look like a valid booking ID" });
      return;
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: "Booking not found" });
      return;
    }
    if (booking.status !== "booked") {
      res.status(400).json({ message: `Booking already ${booking.status}` });
      return;
    }
    booking.status = "checked-in";
    booking.checkedInAt = new Date();
    await booking.save();
    res.status(200).json({ message: "Checked in", booking });
  } catch (error) {
    res.status(500).json({ message: "Check-in failed", error: (error as Error).message });
  }
};

// @route PATCH /api/librarian/borrow/:recordId/return
export const returnBook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.recordId)) {
      res.status(400).json({ message: "That doesn't look like a valid borrow record ID" });
      return;
    }
    const record = await BorrowRecord.findById(req.params.recordId);
    if (!record) {
      res.status(404).json({ message: "Borrow record not found" });
      return;
    }
    if (record.status === "returned" || record.status === "purchased") {
      res.status(400).json({ message: `Book already ${record.status}` });
      return;
    }

    const fine = calculateFine(record.dueDate);
    record.fine = fine;
    record.finePaid = fine === 0; // librarian marks paid separately if there's a fine
    record.status = "returned";
    record.returnDate = new Date();
    await record.save();

    await Book.findByIdAndUpdate(record.book, { $inc: { availableCopies: 1 } });

    // A copy just became available — notify the earliest waiting reservation, if any.
    const nextInQueue = await Reservation.findOne({ book: record.book, status: "waiting" }).sort({
      createdAt: 1,
    });
    if (nextInQueue) {
      nextInQueue.status = "notified";
      await nextInQueue.save();
    }

    const [returnStudent, returnedBook] = await Promise.all([
      User.findById(record.student),
      Book.findById(record.book),
    ]);
    if (returnStudent && returnedBook) {
      const { subject, html } = returnConfirmationEmail({
        studentName: returnStudent.name,
        bookTitle: returnedBook.title,
        onTime: fine === 0,
        fine,
      });
      sendEmail({ to: returnStudent.email, subject, html });
    }

    res.status(200).json({ message: "Book returned", record });
  } catch (error) {
    res.status(500).json({ message: "Return failed", error: (error as Error).message });
  }
};

// @route PATCH /api/librarian/borrow/:recordId/mark-fine-paid
// Used when a student pays their fine in person (cash) at the desk.
export const markFinePaid = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.recordId)) {
      res.status(400).json({ message: "That doesn't look like a valid borrow record ID" });
      return;
    }
    const record = await BorrowRecord.findById(req.params.recordId);
    if (!record) {
      res.status(404).json({ message: "Borrow record not found" });
      return;
    }
    record.finePaid = true;
    await record.save();
    res.status(200).json({ message: "Fine marked as paid", record });
  } catch (error) {
    res.status(500).json({ message: "Failed to update fine status", error: (error as Error).message });
  }
};

// @route GET /api/librarian/daily-summary
export const getDailySummary = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [checkInsToday, booksIssuedToday, booksReturnedToday, attendanceToday] =
      await Promise.all([
        Booking.countDocuments({ checkedInAt: { $gte: startOfDay } }),
        BorrowRecord.countDocuments({ issueDate: { $gte: startOfDay } }),
        BorrowRecord.countDocuments({ returnDate: { $gte: startOfDay } }),
        Attendance.countDocuments({ createdAt: { $gte: startOfDay }, type: "entry" }),
      ]);

    res.status(200).json({
      date: startOfDay.toDateString(),
      checkInsToday,
      booksIssuedToday,
      booksReturnedToday,
      attendanceToday,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to build summary", error: (error as Error).message });
  }
};
