import express from "express";
import { getExercises, getExerciseById, createExercise } from "../controllers/exerciseController.js";
import { requireAuth } from "@clerk/express";

const exerciseRouter = express.Router();

exerciseRouter.get("/", requireAuth(), getExercises);
exerciseRouter.get("/:id", requireAuth(), getExerciseById);
exerciseRouter.post("/", requireAuth(), createExercise);

export default exerciseRouter;
