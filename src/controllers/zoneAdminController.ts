import { Response } from "express";
import Zone from "../models/Zone";
import Seat from "../models/Seat";
import Booking from "../models/Booking";
import { AuthRequest } from "../middleware/authMiddleware";

// @route POST /api/admin/zones
export const createZone = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, restrictedToDepartment } = req.body;
    if (!name) {
      res.status(400).json({ message: "Zone name is required" });
      return;
    }
    const zone = await Zone.create({ name, description, restrictedToDepartment, totalSeats: 0 });
    res.status(201).json(zone);
  } catch (error) {
    res.status(500).json({ message: "Failed to create zone", error: (error as Error).message });
  }
};

// @route GET /api/admin/zones
export const listZones = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const zones = await Zone.find().sort({ createdAt: -1 });
    res.status(200).json(zones);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch zones", error: (error as Error).message });
  }
};

// @route DELETE /api/admin/zones/:id
export const deleteZone = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const zoneId = req.params.id;

    const seatIds = (await Seat.find({ zone: zoneId }).select("_id")).map((s) => s._id);
    const hasActiveBooking = await Booking.exists({
      seat: { $in: seatIds },
      status: { $in: ["booked", "checked-in"] },
    });

    if (hasActiveBooking) {
      res.status(409).json({
        message: "Cannot delete this zone — it has active or upcoming bookings. Wait for them to finish or cancel them first.",
      });
      return;
    }

    await Zone.findByIdAndDelete(zoneId);
    await Seat.deleteMany({ zone: zoneId });
    res.status(200).json({ message: "Zone deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete zone", error: (error as Error).message });
  }
};

// @route DELETE /api/admin/zones/:zoneId/seats/:seatId
export const deleteSeat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { zoneId, seatId } = req.params;

    const hasActiveBooking = await Booking.exists({
      seat: seatId,
      status: { $in: ["booked", "checked-in"] },
    });
    if (hasActiveBooking) {
      res.status(409).json({
        message: "Cannot remove this seat — it has an active or upcoming booking",
      });
      return;
    }

    await Seat.findByIdAndDelete(seatId);
    await Zone.findByIdAndUpdate(zoneId, { $inc: { totalSeats: -1 } });

    res.status(200).json({ message: "Seat removed" });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove seat", error: (error as Error).message });
  }
};

// @route POST /api/admin/zones/:zoneId/seats
export const addSeat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { seatNumber } = req.body;
    const { zoneId } = req.params;

    if (!seatNumber) {
      res.status(400).json({ message: "seatNumber is required" });
      return;
    }

    const zone = await Zone.findById(zoneId);
    if (!zone) {
      res.status(404).json({ message: "Zone not found" });
      return;
    }

    const seat = await Seat.create({ zone: zoneId, seatNumber });
    zone.totalSeats += 1;
    await zone.save();

    res.status(201).json(seat);
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(409).json({ message: "This seat number already exists in this zone" });
      return;
    }
    res.status(500).json({ message: "Failed to add seat", error: (error as Error).message });
  }
};
