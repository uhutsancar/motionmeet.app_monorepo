import express from "express";
import { protect, attachDbUser, authorizeRole } from "../middlewares/auth.js";
import User from "../models/User.js";
import Plan from "../models/Plan.js";
import { isObjectId, isUserId } from "../utils/validation.js";
import {
  cursorFilter,
  pageFromDocuments,
  parsePagination,
} from "../utils/pagination.js";

const router = express.Router();

// Only superadmins can access these routes
router.use(protect);
router.use(attachDbUser);
router.use(authorizeRole("superadmin"));

router.get("/users", async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100,
    });
    const users = await User.find(cursorFilter(pagination.cursor, "createdAt"))
      .populate("plan")
      .select("-__v -followers -following -connections")
      .sort({ createdAt: -1, _id: -1 })
      .limit(pagination.limit + 1);
    const page = pageFromDocuments(users, pagination.limit, "createdAt");
    res.status(200).json({
      success: true,
      users: page.items,
      nextCursor: page.nextCursor,
    });
  } catch (error) {
    next(error);
  }
});

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "sancaruhut@gmail.com";

router.put("/users/:id/role", async (req, res, next) => {
  try {
    const { role } = req.body || {};
    if (!isUserId(req.params.id) || !["user", "admin", "superadmin"].includes(role)) {
        return res.status(400).json({ success: false, message: "Invalid role" });
    }
    // Kendi superadmin rolünü düşüremezsin
    if (req.params.id === req.userId && role !== "superadmin") {
      return res.status(400).json({ success: false, message: "You cannot remove your own superadmin role" });
    }
    // SuperAdmin email sahibinin rolü düşürülemez (başka bir admin tarafından bile)
    const targetUser = await User.findById(req.params.id).select("email role");
    if (!targetUser) return res.status(404).json({ success: false, message: "User not found" });
    if (targetUser.email === SUPER_ADMIN_EMAIL && role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "The primary superadmin account role cannot be changed",
      });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
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

    // Plan bilgisini ve abonelik durumunu güncelle
    const isFreePlan = plan.slug === "free" || plan.price === 0;
    const planUpdateFields = {
      plan: plan._id,
      planStatus: isFreePlan ? "free" : "active",
      planStartDate: isFreePlan ? null : new Date(),
      planEndDate: null,
      planCancelledAt: null,
    };

    const user = await User.findByIdAndUpdate(
      req.params.id,
      planUpdateFields,
      { new: true }
    ).populate("plan");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.status(200).json({ success: true, user });
  } catch (error) {
    return next(error);
  }
});

export default router;
