import express, { Application, Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "./config/db";
import { startCronJobs } from "./utils/cronJobs";

import authRoutes from "./routes/authRoutes";
import adminRoutes from "./routes/adminRoutes";
import bookingRoutes from "./routes/bookingRoutes";
import bookRoutes from "./routes/bookRoutes";
import attendanceRoutes from "./routes/attendanceRoutes";
import librarianRoutes from "./routes/librarianRoutes";
import noticeRoutes from "./routes/noticeRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import { stripeWebhook } from "./controllers/paymentController";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);
// Stripe webhook needs the RAW request body to verify its signature, so it
// must be mounted before the global express.json() parser below.
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), stripeWebhook);

app.use(express.json());
app.use(cookieParser());

// Health check
app.get("/", (_req: Request, res: Response) => {
  res.json({ status: "ok", message: "Smart Library System API is running" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/librarian", librarianRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/payments", paymentRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler — safety net for anything not already caught inside
// a controller (e.g. a malformed ID slipping through, an unexpected
// async rejection). Keeps the API from ever leaking a raw stack trace.
app.use((err: any, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);

  if (err?.name === "CastError") {
    res.status(400).json({ message: "Invalid ID format" });
    return;
  }
  if (err?.code === 11000) {
    res.status(409).json({ message: "A record with these details already exists" });
    return;
  }
  res.status(500).json({ message: "Something went wrong on the server" });
});

const start = async () => {
  await connectDB();
  startCronJobs();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

start();
