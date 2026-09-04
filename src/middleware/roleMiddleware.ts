import { Response, NextFunction } from "express";
import { AuthRequest } from "./authMiddleware";
import { UserRole } from "../interfaces/IUser";

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Not authorized" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        message: `Role '${req.user.role}' is not allowed to access this resource`,
      });
      return;
    }

    next();
  };
};
