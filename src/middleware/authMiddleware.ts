import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { UserRole } from "../interfaces/IUser";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
  };
}

interface DecodedToken {
  id: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      res.status(401).json({ message: "Not authorized, no token" });
      return;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as DecodedToken;

    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(401).json({ message: "Not authorized, user not found" });
      return;
    }

    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (error) {
    res.status(401).json({ message: "Not authorized, token invalid" });
  }
};
