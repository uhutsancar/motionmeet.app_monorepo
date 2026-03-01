import express from "express";
import { logWorkout, getUserWorkouts, getWorkoutStats } from "../controllers/workoutController.js";
import { protect } from "../middlewares/auth.js";

const workoutRouter = express.Router();

workoutRouter.post("/", protect, logWorkout);
workoutRouter.get("/", protect, getUserWorkouts);
workoutRouter.get("/stats", protect, getWorkoutStats);

export default workoutRouter;
