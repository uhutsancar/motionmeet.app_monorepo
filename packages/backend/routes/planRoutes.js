import express from "express";
import { protect, attachDbUser } from "../middlewares/auth.js";
import { getPlans, updateMyPlan } from "../controllers/planController.js";

const router = express.Router();

router.get("/", getPlans);
router.post("/update", protect, attachDbUser, updateMyPlan);

export default router;
