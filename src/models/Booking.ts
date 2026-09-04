import { Schema, model, Document, Types } from "mongoose";

export type BookingStatus =
  | "booked"
  | "checked-in"
  | "completed"
  | "no-show"
  | "cancelled";

export interface IBooking extends Document {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  seat: Types.ObjectId;
  zone: Types.ObjectId;
  startTime: Date;
  endTime: Date;
  status: BookingStatus;
  qrToken: string;
  checkedInAt?: Date;
  reminderSent: boolean;
}

const bookingSchema = new Schema<IBooking>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    seat: { type: Schema.Types.ObjectId, ref: "Seat", required: true },
    zone: { type: Schema.Types.ObjectId, ref: "Zone", required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ["booked", "checked-in", "completed", "no-show", "cancelled"],
      default: "booked",
    },
    qrToken: { type: String, required: true, unique: true },
    checkedInAt: { type: Date },
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default model<IBooking>("Booking", bookingSchema);
