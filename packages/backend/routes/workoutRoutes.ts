import express from "express";
import { logWorkout, getUserWorkouts, getWorkoutShareCard, getWorkoutStats } from "../controllers/workoutController.js";
import { protect, attachDbUser } from "../middlewares/auth.js";

const workoutRouter = express.Router();

workoutRouter.post("/", protect, attachDbUser, logWorkout);
workoutRouter.get("/", protect, getUserWorkouts);
workoutRouter.get("/stats", protect, getWorkoutStats);
// Registered after the literal path so "stats" is never read as an id.
workoutRouter.get("/:workoutId/share-card", protect, getWorkoutShareCard);

export default workoutRouter;
