import { Schema, model, Document, Types } from "mongoose";

export interface IReservation extends Document {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  book: Types.ObjectId;
  status: "waiting" | "notified" | "fulfilled" | "cancelled";
  createdAt: Date;
}

const reservationSchema = new Schema<IReservation>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    status: {
      type: String,
      enum: ["waiting", "notified", "fulfilled", "cancelled"],
      default: "waiting",
    },
  },
  { timestamps: true }
);

export default model<IReservation>("Reservation", reservationSchema);
