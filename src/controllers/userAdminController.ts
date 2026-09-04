import { Response } from "express";
import { isValidObjectId } from "mongoose";
import User from "../models/User";
import { AuthRequest } from "../middleware/authMiddleware";
import { UserRole } from "../interfaces/IUser";

const VALID_ROLES: UserRole[] = ["student", "librarian", "admin"];

// @route GET /api/admin/users?search=&role=
export const listUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, role } = req.query as { search?: string; role?: string };

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (role && VALID_ROLES.includes(role as UserRole)) {
      filter.role = role;
    }

    const users = await User.find(filter).select("-password").sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users", error: (error as Error).message });
  }
};

// @route PATCH /api/admin/users/:id/role  { role }
export const updateUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body as { role: UserRole };

    if (!isValidObjectId(id)) {
      res.status(400).json({ message: "That doesn't look like a valid user ID" });
      return;
    }
    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({ message: `role must be one of: ${VALID_ROLES.join(", ")}` });
      return;
    }
    if (id === req.user!.id && role !== "admin") {
      res.status(400).json({ message: "You can't remove your own admin access" });
      return;
    }

    const user = await User.findByIdAndUpdate(id, { role }, { new: true }).select("-password");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Failed to update role", error: (error as Error).message });
  }
};

// @route DELETE /api/admin/users/:id
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ message: "That doesn't look like a valid user ID" });
      return;
    }
    if (id === req.user!.id) {
      res.status(400).json({ message: "You can't delete your own account from here" });
      return;
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user", error: (error as Error).message });
  }
};
