import jwt from "jsonwebtoken";
import { Response } from "express";
import { Types } from "mongoose";
import { UserRole } from "../interfaces/IUser";

interface TokenPayload {
  id: string;
  role: UserRole;
}

export const generateToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_SECRET as string;
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
};

export const setTokenCookie = (
  res: Response,
  userId: Types.ObjectId,
  role: UserRole
): void => {
  const token = generateToken({ id: userId.toString(), role });

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};
