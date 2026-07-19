import express from "express";
import { getMuscleGroups } from "../controllers/muscleGroupController.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

router.get("/", protect, getMuscleGroups);

export default router;
