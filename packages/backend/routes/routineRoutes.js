import express from "express";
import { getUserRoutines, createRoutine, updateRoutine, deleteRoutine } from "../controllers/routineController.js";
import { requireAuth } from "@clerk/express";
import { protect, attachDbUser } from "../middlewares/auth.js";

const routineRouter = express.Router();

routineRouter.get("/", requireAuth(), getUserRoutines);
routineRouter.post("/", protect, attachDbUser, createRoutine);
routineRouter.put("/:id", requireAuth(), updateRoutine);
routineRouter.delete("/:id", requireAuth(), deleteRoutine);

export default routineRouter;
