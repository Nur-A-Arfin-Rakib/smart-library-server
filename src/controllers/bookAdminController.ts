import { Response } from "express";
import Book from "../models/Book";
import BorrowRecord from "../models/BorrowRecord";
import Wishlist from "../models/Wishlist";
import Reservation from "../models/Reservation";
import Review from "../models/Review";
import { AuthRequest } from "../middleware/authMiddleware";

// @route POST /api/admin/books
export const createBook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, author, isbn, category, shelfLocation, totalCopies } = req.body;
    if (!title || !author || !isbn) {
      res.status(400).json({ message: "title, author and isbn are required" });
      return;
    }
    const copies = totalCopies ?? 1;
    const book = await Book.create({
      title,
      author,
      isbn,
      category,
      shelfLocation,
      totalCopies: copies,
      availableCopies: copies,
    });
    res.status(201).json(book);
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(409).json({ message: "A book with this ISBN already exists" });
      return;
    }
    res.status(500).json({ message: "Failed to add book", error: (error as Error).message });
  }
};

// @route PUT /api/admin/books/:id
export const updateBook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, author, category, shelfLocation, totalCopies } = req.body;
    const book = await Book.findById(req.params.id);
    if (!book) {
      res.status(404).json({ message: "Book not found" });
      return;
    }

    if (title !== undefined) book.title = title;
    if (author !== undefined) book.author = author;
    if (category !== undefined) book.category = category;
    if (shelfLocation !== undefined) book.shelfLocation = shelfLocation;

    // Changing totalCopies must keep availableCopies consistent instead of
    // being overwritten independently (which could desync the two counts —
    // e.g. leaving availableCopies higher than totalCopies, or hiding
    // newly-added copies from being borrowable).
    if (totalCopies !== undefined && totalCopies !== book.totalCopies) {
      const currentlyBorrowed = book.totalCopies - book.availableCopies;
      if (totalCopies < currentlyBorrowed) {
        res.status(409).json({
          message: `Cannot reduce total copies below ${currentlyBorrowed} — that many are currently borrowed`,
        });
        return;
      }
      book.totalCopies = totalCopies;
      book.availableCopies = totalCopies - currentlyBorrowed;
    }

    await book.save();
    res.status(200).json(book);
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(409).json({ message: "A book with this ISBN already exists" });
      return;
    }
    res.status(500).json({ message: "Failed to update book", error: (error as Error).message });
  }
};

// @route DELETE /api/admin/books/:id
export const deleteBook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bookId = req.params.id;

    const hasActiveBorrow = await BorrowRecord.exists({
      book: bookId,
      status: { $in: ["borrowed", "overdue"] },
    });

    if (hasActiveBorrow) {
      res.status(409).json({
        message: "Cannot delete this book — a copy is currently borrowed. Wait for it to be returned first.",
      });
      return;
    }

    await Book.findByIdAndDelete(bookId);
    await Wishlist.deleteMany({ book: bookId });
    await Reservation.deleteMany({ book: bookId });
    await Review.deleteMany({ book: bookId });
    res.status(200).json({ message: "Book deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete book", error: (error as Error).message });
  }
};

// @route GET /api/admin/books
export const listAllBooks = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch books", error: (error as Error).message });
  }
};
