import express from "express";
import { getExercises, getExerciseById, createExercise, getExerciseStats, getExerciseHistory, getPersonalRecords } from "../controllers/exerciseController.js";
import { attachDbUser, protect } from "../middlewares/auth.js";
import { createLimiter, memberKey } from "../middlewares/rateLimits.js";

const exerciseRouter = express.Router();
const createExerciseLimiter = createLimiter({
  name: "custom-exercise",
  windowMs: 60 * 60 * 1000,
  limit: 30,
  key: memberKey,
  message: { success: false, message: "Too many custom exercises" },
});

exerciseRouter.get("/", protect, getExercises);
exerciseRouter.get("/records", protect, getPersonalRecords);
exerciseRouter.get("/:id", protect, getExerciseById);
exerciseRouter.get("/:id/stats", protect, getExerciseStats);
exerciseRouter.get("/:id/history", protect, getExerciseHistory);
exerciseRouter.post("/", protect, createExerciseLimiter, attachDbUser, createExercise);

export default exerciseRouter;
