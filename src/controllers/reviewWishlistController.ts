import { Response } from "express";
import Review from "../models/Review";
import Wishlist from "../models/Wishlist";
import BorrowRecord from "../models/BorrowRecord";
import { AuthRequest } from "../middleware/authMiddleware";

// @route POST /api/books/:bookId/review  { rating, comment }
export const addReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = req.user!.id;
    const { bookId } = req.params;
    const { rating, comment } = req.body as { rating: number; comment?: string };

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ message: "rating must be between 1 and 5" });
      return;
    }

    // Only students who have actually borrowed the book can review it
    const hasBorrowed = await BorrowRecord.exists({ student: studentId, book: bookId });
    if (!hasBorrowed) {
      res.status(403).json({ message: "You can only review books you've borrowed" });
      return;
    }

    const review = await Review.findOneAndUpdate(
      { student: studentId, book: bookId },
      { rating, comment },
      { upsert: true, new: true }
    );

    res.status(200).json(review);
  } catch (error) {
    res.status(500).json({ message: "Failed to submit review", error: (error as Error).message });
  }
};

// @route GET /api/books/:bookId/reviews
export const getBookReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reviews = await Review.find({ book: req.params.bookId })
      .populate("student", "name")
      .sort({ createdAt: -1 });

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    res.status(200).json({ reviews, avgRating: Math.round(avgRating * 10) / 10 });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch reviews", error: (error as Error).message });
  }
};

// @route POST /api/books/:bookId/wishlist
export const toggleWishlist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = req.user!.id;
    const { bookId } = req.params;

    const existing = await Wishlist.findOne({ student: studentId, book: bookId });
    if (existing) {
      await existing.deleteOne();
      res.status(200).json({ message: "Removed from wishlist", wishlisted: false });
      return;
    }

    await Wishlist.create({ student: studentId, book: bookId });
    res.status(201).json({ message: "Added to wishlist", wishlisted: true });
  } catch (error) {
    res.status(500).json({ message: "Wishlist update failed", error: (error as Error).message });
  }
};

// @route GET /api/books/wishlist/my
export const getMyWishlist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const items = await Wishlist.find({ student: req.user!.id }).populate("book");
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch wishlist", error: (error as Error).message });
  }
};
