import { Document, Types } from "mongoose";

export type UserRole = "student" | "librarian" | "admin";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  googleId?: string;
  role: UserRole;
  avatarUrl?: string;
  studentId?: string; // used for digital library card / QR
  department?: string;
  isVerified: boolean;
  comparePassword(candidatePassword: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}
