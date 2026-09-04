import { Schema, model, Document, Types } from "mongoose";

export interface ISeat extends Document {
  _id: Types.ObjectId;
  zone: Types.ObjectId;
  seatNumber: string;
}

const seatSchema = new Schema<ISeat>(
  {
    zone: { type: Schema.Types.ObjectId, ref: "Zone", required: true },
    seatNumber: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

seatSchema.index({ zone: 1, seatNumber: 1 }, { unique: true });

export default model<ISeat>("Seat", seatSchema);
