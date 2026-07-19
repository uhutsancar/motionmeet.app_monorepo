import express from "express";
import { getExercises, getExerciseById, createExercise, getExerciseStats } from "../controllers/exerciseController.js";
import { attachDbUser, protect } from "../middlewares/auth.js";

const exerciseRouter = express.Router();

exerciseRouter.get("/", protect, getExercises);
exerciseRouter.get("/:id", protect, getExerciseById);
exerciseRouter.get("/:id/stats", protect, getExerciseStats);
exerciseRouter.post("/", protect, attachDbUser, createExercise);

export default exerciseRouter;
