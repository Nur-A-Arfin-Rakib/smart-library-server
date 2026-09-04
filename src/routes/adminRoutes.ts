import { Router, Response } from "express";
import { protect, AuthRequest } from "../middleware/authMiddleware";
import { authorize } from "../middleware/roleMiddleware";
import { createZone, listZones, deleteZone, addSeat, deleteSeat } from "../controllers/zoneAdminController";
import { createBook, updateBook, deleteBook, listAllBooks } from "../controllers/bookAdminController";
import { getOverview, getOccupancyTrend, getPopularZones } from "../controllers/analyticsController";
import { createNotice, deleteNotice } from "../controllers/noticeController";
import { listUsers, updateUserRole, deleteUser } from "../controllers/userAdminController";

const router = Router();

router.use(protect, authorize("admin"));

router.get("/dashboard-check", (req: AuthRequest, res: Response) => {
  res.status(200).json({ message: "Welcome, admin. You have full access." });
});

// User management
router.get("/users", listUsers);
router.patch("/users/:id/role", updateUserRole);
router.delete("/users/:id", deleteUser);

// Zone & seat management
router.post("/zones", createZone);
router.get("/zones", listZones);
router.delete("/zones/:id", deleteZone);
router.post("/zones/:zoneId/seats", addSeat);
router.delete("/zones/:zoneId/seats/:seatId", deleteSeat);

// Book management
router.get("/books", listAllBooks);
router.post("/books", createBook);
router.put("/books/:id", updateBook);
router.delete("/books/:id", deleteBook);

// Analytics
router.get("/analytics/overview", getOverview);
router.get("/analytics/occupancy-trend", getOccupancyTrend);
router.get("/analytics/popular-zones", getPopularZones);

// Broadcast notices
router.post("/notices", createNotice);
router.delete("/notices/:id", deleteNotice);

export default router;
