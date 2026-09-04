import { Schema, model, Document, Types } from "mongoose";

export interface IAttendance extends Document {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  type: "entry" | "exit";
  createdAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["entry", "exit"], required: true },
  },
  { timestamps: true }
);

export default model<IAttendance>("Attendance", attendanceSchema);
