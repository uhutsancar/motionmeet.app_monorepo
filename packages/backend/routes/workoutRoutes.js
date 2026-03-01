import express from "express";
import { logWorkout, getUserWorkouts } from "../controllers/workoutController.js";
import { protect } from "../middlewares/auth.js";

const workoutRouter = express.Router();

workoutRouter.post("/", protect, logWorkout);
workoutRouter.get("/", protect, getUserWorkouts);

export default workoutRouter;
