import { Router } from "express";
import {
  searchBooks,
  borrowBook,
  getMyBorrows,
  renewBook,
  reserveBook,
  payFine,
  getMyReservations,
} from "../controllers/bookController";
import {
  addReview,
  getBookReviews,
  toggleWishlist,
  getMyWishlist,
} from "../controllers/reviewWishlistController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.get("/", protect, searchBooks);
router.get("/my-borrows", protect, getMyBorrows);
router.get("/wishlist/my", protect, getMyWishlist);
router.get("/reservations/my", protect, getMyReservations);

router.post("/:bookId/borrow", protect, borrowBook);
router.post("/:bookId/reserve", protect, reserveBook);
router.post("/:bookId/review", protect, addReview);
router.get("/:bookId/reviews", protect, getBookReviews);
router.post("/:bookId/wishlist", protect, toggleWishlist);

router.patch("/borrow/:recordId/renew", protect, renewBook);
router.post("/borrow/:recordId/pay-fine", protect, payFine);

export default router;
