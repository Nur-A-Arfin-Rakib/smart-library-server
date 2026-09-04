import { Response } from "express";
import crypto from "crypto";
import Booking from "../models/Booking";
import Seat from "../models/Seat";
import Zone from "../models/Zone";
import User from "../models/User";
import NoShowRecord from "../models/NoShowRecord";
import { AuthRequest } from "../middleware/authMiddleware";
import { sendEmail, bookingConfirmationEmail, bookingReminderEmail } from "../utils/email";

const GRACE_PERIOD_MINUTES = 15;
const NO_SHOW_THRESHOLD = 3; // after this many no-shows, block bookings temporarily
const BLOCK_DURATION_DAYS = 3;

// @route GET /api/bookings/zones
// Returns all zones with seat availability status for a given time range.
export const getZonesWithAvailability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { start, end } = req.query as { start?: string; end?: string };

    const zones = await Zone.find();
    const seats = await Seat.find();

    let overlappingBookings: { seat: any }[] = [];
    if (start && end) {
      overlappingBookings = await Booking.find({
        status: { $in: ["booked", "checked-in"] },
        startTime: { $lt: new Date(end) },
        endTime: { $gt: new Date(start) },
      }).select("seat");
    }

    const bookedSeatIds = new Set(overlappingBookings.map((b) => b.seat.toString()));

    const zonesWithSeats = zones.map((zone) => {
      const zoneSeats = seats
        .filter((s) => s.zone.toString() === zone._id.toString())
        .map((s) => ({
          id: s._id,
          seatNumber: s.seatNumber,
          status: bookedSeatIds.has(s._id.toString()) ? "booked" : "available",
        }));

      return {
        id: zone._id,
        name: zone.name,
        description: zone.description,
        restrictedToDepartment: zone.restrictedToDepartment,
        seats: zoneSeats,
      };
    });

    res.status(200).json(zonesWithSeats);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch zones", error: (error as Error).message });
  }
};

// @route POST /api/bookings
export const createBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = req.user!.id;
    const { seatId, startTime, endTime } = req.body;

    if (!seatId || !startTime || !endTime) {
      res.status(400).json({ message: "seatId, startTime and endTime are required" });
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ message: "Invalid startTime or endTime" });
      return;
    }
    if (start >= end) {
      res.status(400).json({ message: "endTime must be after startTime" });
      return;
    }
    if (start < new Date(Date.now() - 60 * 1000)) {
      // small 1-minute leeway for clock skew between client and server
      res.status(400).json({ message: "startTime cannot be in the past" });
      return;
    }
    const MAX_BOOKING_HOURS = 8;
    if (end.getTime() - start.getTime() > MAX_BOOKING_HOURS * 60 * 60 * 1000) {
      res.status(400).json({ message: `A single booking cannot exceed ${MAX_BOOKING_HOURS} hours` });
      return;
    }

    // Block if student is currently no-show restricted
    const noShow = await NoShowRecord.findOne({ student: studentId });
    if (noShow?.blockedUntil && noShow.blockedUntil > new Date()) {
      res.status(403).json({
        message: `Booking temporarily blocked due to repeated no-shows. Try again after ${noShow.blockedUntil.toDateString()}`,
      });
      return;
    }

    const seat = await Seat.findById(seatId);
    if (!seat) {
      res.status(404).json({ message: "Seat not found" });
      return;
    }

    // Department/course restriction check
    const zone = await Zone.findById(seat.zone);
    if (zone?.restrictedToDepartment) {
      const student = await User.findById(studentId);
      const studentDept = student?.department?.trim().toLowerCase();
      const requiredDept = zone.restrictedToDepartment.trim().toLowerCase();
      if (studentDept !== requiredDept) {
        res.status(403).json({
          message: `This zone is reserved for ${zone.restrictedToDepartment} students`,
        });
        return;
      }
    }

    // Overlap check
    const overlap = await Booking.findOne({
      seat: seatId,
      status: { $in: ["booked", "checked-in"] },
      startTime: { $lt: new Date(endTime) },
      endTime: { $gt: new Date(startTime) },
    });
    if (overlap) {
      res.status(409).json({ message: "This seat is already booked for the selected time" });
      return;
    }

    const qrToken = crypto.randomBytes(16).toString("hex");

    const booking = await Booking.create({
      student: studentId,
      seat: seatId,
      zone: seat.zone,
      startTime,
      endTime,
      qrToken,
    });

    // Fire-and-forget confirmation email — sendEmail already catches its own
    // errors, so a failed/unconfigured email service never blocks the booking.
    const bookingStudent = await User.findById(studentId);
    if (bookingStudent) {
      const { subject, html } = bookingConfirmationEmail({
        studentName: bookingStudent.name,
        zoneName: zone?.name || "the library",
        seatNumber: seat.seatNumber,
        startTime: start,
        endTime: end,
      });
      sendEmail({ to: bookingStudent.email, subject, html });
    }

    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ message: "Booking failed", error: (error as Error).message });
  }
};

// @route GET /api/bookings/my
export const getMyBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bookings = await Booking.find({ student: req.user!.id })
      .populate("seat", "seatNumber")
      .populate("zone", "name")
      .sort({ startTime: -1 });
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch bookings", error: (error as Error).message });
  }
};

// @route POST /api/bookings/checkin/:qrToken
// Called when the QR code is scanned at the entrance (by student's own device or a librarian kiosk).
export const checkInBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { qrToken } = req.params;
    const booking = await Booking.findOne({ qrToken });

    if (!booking) {
      res.status(404).json({ message: "Invalid QR code" });
      return;
    }
    if (booking.status !== "booked") {
      res.status(400).json({ message: `Booking already ${booking.status}` });
      return;
    }

    const now = new Date();
    const EARLY_CHECKIN_BUFFER_MINUTES = 15;
    const earliestAllowed = new Date(booking.startTime.getTime() - EARLY_CHECKIN_BUFFER_MINUTES * 60 * 1000);

    if (now < earliestAllowed) {
      res.status(400).json({
        message: `Too early to check in — you can check in from ${EARLY_CHECKIN_BUFFER_MINUTES} minutes before your slot starts`,
      });
      return;
    }
    if (now > booking.endTime) {
      res.status(400).json({ message: "This booking's time slot has already ended" });
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

// @route PATCH /api/bookings/:id/cancel
export const cancelBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, student: req.user!.id });
    if (!booking) {
      res.status(404).json({ message: "Booking not found" });
      return;
    }
    if (booking.status !== "booked") {
      res.status(400).json({ message: "Only an upcoming booking can be cancelled" });
      return;
    }
    booking.status = "cancelled";
    await booking.save();
    res.status(200).json({ message: "Booking cancelled" });
  } catch (error) {
    res.status(500).json({ message: "Cancel failed", error: (error as Error).message });
  }
};

// Runs frequently (every minute — see utils/cronJobs.ts) — emails students
// whose booking starts in roughly 10 minutes, once each, using the
// reminderSent flag to avoid duplicate emails.
export const sweepBookingReminders = async (): Promise<void> => {
  const windowStart = new Date(Date.now() + 9 * 60 * 1000);
  const windowEnd = new Date(Date.now() + 11 * 60 * 1000);

  const upcoming = await Booking.find({
    status: "booked",
    reminderSent: false,
    startTime: { $gte: windowStart, $lte: windowEnd },
  })
    .populate("student", "name email")
    .populate("seat", "seatNumber")
    .populate("zone", "name");

  for (const booking of upcoming) {
    const student = booking.student as any;
    const seat = booking.seat as any;
    const zone = booking.zone as any;

    if (student?.email) {
      const { subject, html } = bookingReminderEmail({
        studentName: student.name,
        zoneName: zone?.name || "the library",
        seatNumber: seat?.seatNumber || "",
        startTime: booking.startTime,
      });
      await sendEmail({ to: student.email, subject, html });
    }

    booking.reminderSent = true;
    await booking.save();
  }
};

// Runs periodically — marks checked-in bookings as "completed" once their
// time slot has ended, so the status doesn't stay stuck at "checked-in" forever.
export const sweepCompletedBookings = async (): Promise<void> => {
  await Booking.updateMany(
    { status: "checked-in", endTime: { $lt: new Date() } },
    { $set: { status: "completed" } }
  );
};

// Runs periodically (see utils/cronJobs.ts) — auto-cancels bookings where the
// grace period has passed without check-in, and applies no-show penalties.
export const sweepNoShowBookings = async (): Promise<void> => {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_MINUTES * 60 * 1000);

  const overdue = await Booking.find({
    status: "booked",
    startTime: { $lt: cutoff },
  });

  for (const booking of overdue) {
    booking.status = "no-show";
    await booking.save();

    let record = await NoShowRecord.findOne({ student: booking.student });
    if (!record) {
      record = await NoShowRecord.create({ student: booking.student, count: 0 });
    }
    record.count += 1;

    if (record.count >= NO_SHOW_THRESHOLD) {
      record.blockedUntil = new Date(Date.now() + BLOCK_DURATION_DAYS * 24 * 60 * 60 * 1000);
      record.count = 0; // reset counter after applying a block
    }
    await record.save();
  }
};
