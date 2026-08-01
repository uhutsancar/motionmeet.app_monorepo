import express from "express";
import { getExercises, getExerciseById, createExercise, getExerciseStats, getPersonalRecords } from "../controllers/exerciseController.js";
import { attachDbUser, protect } from "../middlewares/auth.js";
import rateLimit from "express-rate-limit";
import { createRateLimitStore } from "../configs/redis.js";

const exerciseRouter = express.Router();
const createExerciseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("custom-exercise"),
  message: { success: false, message: "Too many custom exercises" },
});

exerciseRouter.get("/", protect, getExercises);
exerciseRouter.get("/records", protect, getPersonalRecords);
exerciseRouter.get("/:id", protect, getExerciseById);
exerciseRouter.get("/:id/stats", protect, getExerciseStats);
exerciseRouter.post("/", protect, createExerciseLimiter, attachDbUser, createExercise);

export default exerciseRouter;
