import { Schema, model, Document, Types } from "mongoose";

export interface IOtp extends Document {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  code: string;
  purpose: "entry" | "exit";
  expiresAt: Date;
  used: boolean;
}

const otpSchema = new Schema<IOtp>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    code: { type: String, required: true },
    purpose: { type: String, enum: ["entry", "exit"], required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Mongo TTL index — automatically removes expired OTP documents
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model<IOtp>("Otp", otpSchema);
