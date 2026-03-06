import express from "express";
import { protect, attachDbUser, authorizeRole } from "../middlewares/auth.js";
import User from "../models/User.js";
import Plan from "../models/Plan.js";

const router = express.Router();

// Only superadmins can access these routes
router.use(protect);
router.use(attachDbUser);
router.use(authorizeRole("superadmin"));

router.get("/users", async (req, res) => {
  try {
    const users = await User.find().populate("plan").select("-__v");
    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/users/:id/role", async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user", "admin", "superadmin"].includes(role)) {
        return res.status(400).json({ success: false, message: "Invalid role" });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
