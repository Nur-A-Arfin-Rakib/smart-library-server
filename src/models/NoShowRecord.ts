import { Schema, model, Document, Types } from "mongoose";

// Tracks a student's no-show count for seat bookings.
// After a configurable threshold, new bookings are temporarily blocked.
export interface INoShowRecord extends Document {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  count: number;
  blockedUntil?: Date;
}

const noShowSchema = new Schema<INoShowRecord>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    count: { type: Number, default: 0 },
    blockedUntil: { type: Date },
  },
  { timestamps: true }
);

export default model<INoShowRecord>("NoShowRecord", noShowSchema);
