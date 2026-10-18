import { Response } from "express";
import Book from "../models/Book";
import BorrowRecord from "../models/BorrowRecord";
import Reservation from "../models/Reservation";
import Review from "../models/Review";
import User from "../models/User";
import { AuthRequest } from "../middleware/authMiddleware";
import { sendEmail, borrowConfirmationEmail, dueDateReminderEmail } from "../utils/email";
import {
  calculateFine,
  FINE_CAP,
  BORROW_LIMIT,
  BORROW_DURATION_DAYS,
  RENEWAL_DAYS,
} from "../utils/fine";

// @route GET /api/books?search=&category=
export const searchBooks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, category } = req.query as { search?: string; category?: string };

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { author: { $regex: search, $options: "i" } },
      ];
    }
    if (category) filter.category = category;

    const books = await Book.find(filter).sort({ title: 1 });

    // Attach average rating + review count so the catalog can show stars
    // without a separate request per book.
    const ratings = await Review.aggregate([
      { $group: { _id: "$book", avgRating: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    const ratingMap = new Map(
      ratings.map((r) => [r._id.toString(), { avgRating: Math.round(r.avgRating * 10) / 10, count: r.count }])
    );

    const withRatings = books.map((b) => ({
      ...b.toObject(),
      avgRating: ratingMap.get(b._id.toString())?.avgRating ?? null,
      reviewCount: ratingMap.get(b._id.toString())?.count ?? 0,
    }));

    res.status(200).json(withRatings);
  } catch (error) {
    res.status(500).json({ message: "Search failed", error: (error as Error).message });
  }
};

// @route POST /api/books/:bookId/borrow
export const borrowBook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = req.user!.id;
    const { bookId } = req.params;

    // Block if any unpaid fine exists (either explicitly marked unpaid or currently overdue)
    const unpaidFine = await BorrowRecord.findOne({
      student: studentId,
      finePaid: false,
    });
    if (unpaidFine) {
      res.status(403).json({
        message: "You have an unpaid fine. Please pay it before borrowing a new book.",
      });
      return;
    }

    const activeBorrows = await BorrowRecord.find({
      student: studentId,
      status: { $in: ["borrowed", "overdue"] },
    });
    const hasLiveFine = activeBorrows.some(
      (r) => calculateFine(r.dueDate) > 0 && !r.finePaid
    );
    if (hasLiveFine) {
      res.status(403).json({
        message: "You have an overdue book with an unpaid fine. Please return or pay before borrowing.",
      });
      return;
    }

    // Enforce the 3-book limit
    const activeCount = await BorrowRecord.countDocuments({
      student: studentId,
      status: { $in: ["borrowed", "overdue"] },
    });
    if (activeCount >= BORROW_LIMIT) {
      res.status(403).json({
        message: `You can borrow a maximum of ${BORROW_LIMIT} books at a time`,
      });
      return;
    }

    const book = await Book.findById(bookId);
    if (!book) {
      res.status(404).json({ message: "Book not found" });
      return;
    }
    if (book.availableCopies < 1) {
      res.status(409).json({ message: "No copies available. You can reserve this book instead." });
      return;
    }

    const dueDate = new Date(Date.now() + BORROW_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const record = await BorrowRecord.create({
      student: studentId,
      book: bookId,
      dueDate,
    });

    book.availableCopies -= 1;
    await book.save();

    // If the student had a reservation/hold on this exact book, it's now fulfilled —
    // otherwise it would keep showing as "available, come get it" even after they
    // already borrowed it.
    await Reservation.updateMany(
      { student: studentId, book: bookId, status: { $in: ["waiting", "notified"] } },
      { $set: { status: "fulfilled" } }
    );

    const borrowStudent = await User.findById(studentId);
    if (borrowStudent) {
      const { subject, html } = borrowConfirmationEmail({
        studentName: borrowStudent.name,
        bookTitle: book.title,
        dueDate,
      });
      sendEmail({ to: borrowStudent.email, subject, html });
    }

    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ message: "Borrow failed", error: (error as Error).message });
  }
};

// @route GET /api/books/my-borrows
export const getMyBorrows = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const records = await BorrowRecord.find({ student: req.user!.id })
      .populate("book", "title author isbn")
      .sort({ createdAt: -1 });

    // Refresh fine live (without persisting) so the UI is always accurate
    const withLiveFine = records.map((r) => {
      const liveFine =
        r.status === "borrowed" || r.status === "overdue"
          ? calculateFine(r.dueDate)
          : r.fine;
      // If there is an outstanding live fine, finePaid is false until paid
      const finePaid = liveFine === 0 ? true : r.finePaid;
      return { ...r.toObject(), liveFine, finePaid };
    });

    res.status(200).json(withLiveFine);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch borrow history", error: (error as Error).message });
  }
};

// @route PATCH /api/books/borrow/:recordId/renew
export const renewBook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const record = await BorrowRecord.findOne({
      _id: req.params.recordId,
      student: req.user!.id,
    });
    if (!record) {
      res.status(404).json({ message: "Borrow record not found" });
      return;
    }
    if (record.status !== "borrowed") {
      res.status(400).json({ message: "Only an active borrow can be renewed" });
      return;
    }
    if (record.renewed) {
      res.status(400).json({ message: "This book has already been renewed once" });
      return;
    }

    const hasHold = await Reservation.exists({ book: record.book, status: "waiting" });
    if (hasHold) {
      res.status(409).json({ message: "Cannot renew — another student has this book on hold" });
      return;
    }

    record.dueDate = new Date(record.dueDate.getTime() + RENEWAL_DAYS * 24 * 60 * 60 * 1000);
    record.renewed = true;
    await record.save();

    res.status(200).json(record);
  } catch (error) {
    res.status(500).json({ message: "Renewal failed", error: (error as Error).message });
  }
};

// @route POST /api/books/:bookId/reserve
export const reserveBook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = req.user!.id;
    const { bookId } = req.params;

    const book = await Book.findById(bookId);
    if (!book) {
      res.status(404).json({ message: "Book not found" });
      return;
    }
    if (book.availableCopies > 0) {
      res.status(400).json({ message: "Book is currently available — no need to reserve" });
      return;
    }

    const existing = await Reservation.findOne({ student: studentId, book: bookId, status: "waiting" });
    if (existing) {
      res.status(409).json({ message: "You already have a hold on this book" });
      return;
    }

    const reservation = await Reservation.create({ student: studentId, book: bookId });
    res.status(201).json(reservation);
  } catch (error) {
    res.status(500).json({ message: "Reservation failed", error: (error as Error).message });
  }
};

// @route POST /api/books/borrow/:recordId/pay-fine
// In production this would be called after a successful Stripe/bKash/Nagad payment.
export const payFine = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const record = await BorrowRecord.findOne({
      _id: req.params.recordId,
      student: req.user!.id,
    });
    if (!record) {
      res.status(404).json({ message: "Borrow record not found" });
      return;
    }

    const liveFine =
      record.status === "borrowed" || record.status === "overdue"
        ? calculateFine(record.dueDate)
        : record.fine;

    record.fine = liveFine;
    record.finePaid = true;
    await record.save();

    res.status(200).json({ message: "Fine paid — restrictions lifted", record });
  } catch (error) {
    res.status(500).json({ message: "Payment update failed", error: (error as Error).message });
  }
};

// @route GET /api/books/reservations/my
export const getMyReservations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reservations = await Reservation.find({ student: req.user!.id, status: { $ne: "cancelled" } })
      .populate("book", "title author")
      .sort({ createdAt: -1 });
    res.status(200).json(reservations);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch reservations", error: (error as Error).message });
  }
};

// Runs periodically — recalculates fines for overdue books, converts to
// "purchased" once the fine cap is reached, and notifies the next person
// in a reservation queue when a copy becomes available.
export const sweepOverdueBooks = async (): Promise<void> => {
  const overdue = await BorrowRecord.find({
    status: { $in: ["borrowed", "overdue"] },
    dueDate: { $lt: new Date() },
  });

  for (const record of overdue) {
    const fine = calculateFine(record.dueDate);
    record.fine = fine;
    record.finePaid = fine === 0;

    if (fine >= FINE_CAP && record.status !== "purchased") {
      record.status = "purchased";
      await Book.findByIdAndUpdate(record.book, { $inc: { totalCopies: -1 } });
    } else if (record.status !== "purchased") {
      record.status = "overdue";
    }
    await record.save();
  }
};

// Runs daily — emails students whose book is due in exactly 3 days, once
// each, using the dueReminderSent flag to avoid duplicate emails.
export const sweepDueReminders = async (): Promise<void> => {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() + 3);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setHours(23, 59, 59, 999);

  const dueSoon = await BorrowRecord.find({
    status: "borrowed",
    dueReminderSent: false,
    dueDate: { $gte: windowStart, $lte: windowEnd },
  })
    .populate("student", "name email")
    .populate("book", "title");

  for (const record of dueSoon) {
    const student = record.student as any;
    const book = record.book as any;

    if (student?.email) {
      const { subject, html } = dueDateReminderEmail({
        studentName: student.name,
        bookTitle: book?.title || "your borrowed book",
        dueDate: record.dueDate,
      });
      await sendEmail({ to: student.email, subject, html });
    }

    record.dueReminderSent = true;
    await record.save();
  }
};
