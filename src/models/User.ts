import { Schema, model } from "mongoose";
import bcrypt from "bcryptjs";
import { IUser } from "../interfaces/IUser";

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, minlength: 6, select: false },
    googleId: { type: String, unique: true, sparse: true },
    role: {
      type: String,
      enum: ["student", "librarian", "admin"],
      default: "student",
    },
    avatarUrl: { type: String },
    studentId: { type: String, unique: true, sparse: true },
    department: { type: String },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed password
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

export default model<IUser>("User", userSchema);
