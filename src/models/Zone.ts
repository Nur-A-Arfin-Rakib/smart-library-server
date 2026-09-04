import { Schema, model, Document, Types } from "mongoose";

export interface IZone extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  restrictedToDepartment?: string; // course/department mapping
  totalSeats: number;
}

const zoneSchema = new Schema<IZone>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    restrictedToDepartment: { type: String },
    totalSeats: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export default model<IZone>("Zone", zoneSchema);
