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
// Used when a student can't scan their own QR code or when librarian scans QR code / enters ID.
export const manualCheckIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const term = req.params.id?.trim();
    let booking = null;

    if (isValidObjectId(term)) {
      booking = await Booking.findById(term);
    }
    if (!booking) {
      booking = await Booking.findOne({ qrToken: term });
    }

    if (!booking) {
      res.status(404).json({ message: "Booking not found with that ID or QR token" });
      return;
    }
    if (booking.status !== "booked") {
      res.status(400).json({ message: `Booking already ${booking.status}` });
      return;
    }
    booking.status = "checked-in";
    booking.checkedInAt = new Date();
    await booking.save();
    res.status(200).json({ message: "Checked in successfully", booking });
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

// @route GET /api/librarian/borrows?status=&search=
export const listBorrows = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, search } = req.query as { status?: string; search?: string };
    const query: Record<string, unknown> = {};

    if (status && status !== "all") {
      query.status = status;
    }

    const records = await BorrowRecord.find(query)
      .populate("student", "name email department studentId")
      .populate("book", "title author isbn shelfLocation")
      .sort({ createdAt: -1 })
      .limit(100);

    const withLiveFine = records.map((r) => {
      const liveFine =
        r.status === "borrowed" || r.status === "overdue"
          ? calculateFine(r.dueDate)
          : r.fine;
      const isPaid = liveFine === 0 ? true : r.finePaid;
      return { ...r.toObject(), liveFine, finePaid: isPaid };
    });

    let filtered = withLiveFine;
    if (search) {
      const s = search.toLowerCase();
      filtered = withLiveFine.filter((r: any) => {
        const studentName = r.student?.name?.toLowerCase() || "";
        const studentEmail = r.student?.email?.toLowerCase() || "";
        const bookTitle = r.book?.title?.toLowerCase() || "";
        const bookIsbn = r.book?.isbn?.toLowerCase() || "";
        return (
          studentName.includes(s) ||
          studentEmail.includes(s) ||
          bookTitle.includes(s) ||
          bookIsbn.includes(s) ||
          r._id.toString().includes(s)
        );
      });
    }

    res.status(200).json(filtered);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch borrows", error: (error as Error).message });
  }
};

// @route GET /api/librarian/bookings?status=&search=
export const listBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, search } = req.query as { status?: string; search?: string };
    const query: Record<string, unknown> = {};

    if (status && status !== "all") {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate("student", "name email department studentId")
      .populate("seat", "seatNumber")
      .populate("zone", "name")
      .sort({ startTime: -1 })
      .limit(100);

    let filtered = bookings;
    if (search) {
      const s = search.toLowerCase();
      filtered = bookings.filter((b: any) => {
        const studentName = b.student?.name?.toLowerCase() || "";
        const studentEmail = b.student?.email?.toLowerCase() || "";
        const seatNumber = b.seat?.seatNumber?.toLowerCase() || "";
        const zoneName = b.zone?.name?.toLowerCase() || "";
        const qr = b.qrToken?.toLowerCase() || "";
        return (
          studentName.includes(s) ||
          studentEmail.includes(s) ||
          seatNumber.includes(s) ||
          zoneName.includes(s) ||
          qr.includes(s) ||
          b._id.toString().includes(s)
        );
      });
    }

    res.status(200).json(filtered);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch bookings", error: (error as Error).message });
  }
};

