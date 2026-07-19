import express from "express";
import { protect, attachDbUser, authorizeRole } from "../middlewares/auth.js";
import User from "../models/User.js";
import Plan from "../models/Plan.js";
import { isObjectId, isUserId } from "../utils/validation.js";

const router = express.Router();

// Only superadmins can access these routes
router.use(protect);
router.use(attachDbUser);
router.use(authorizeRole("superadmin"));

router.get("/users", async (req, res, next) => {
  try {
    const users = await User.find().populate("plan").select("-__v");
    res.status(200).json({ success: true, users });
  } catch (error) {
    next(error);
  }
});

router.put("/users/:id/role", async (req, res, next) => {
  try {
    const { role } = req.body || {};
    if (!isUserId(req.params.id) || !["user", "admin", "superadmin"].includes(role)) {
        return res.status(400).json({ success: false, message: "Invalid role" });
    }
    if (req.params.id === req.userId && role !== "superadmin") {
      return res.status(400).json({ success: false, message: "You cannot remove your own superadmin role" });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

router.put("/users/:id/plan", async (req, res, next) => {
  try {
    const { planId } = req.body || {};
    if (!isUserId(req.params.id) || !isObjectId(planId)) {
      return res.status(400).json({ success: false, message: "Invalid user or plan id" });
    }

    const plan = await Plan.findOne({ _id: planId, isActive: true });
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

    const user = await User.findByIdAndUpdate(req.params.id, { plan: plan._id }, { new: true }).populate("plan");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.status(200).json({ success: true, user });
  } catch (error) {
    return next(error);
  }
});

export default router;
