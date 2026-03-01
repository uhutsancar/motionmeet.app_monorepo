import express from "express";
import { getUserRoutines, createRoutine, updateRoutine, deleteRoutine } from "../controllers/routineController.js";
import { requireAuth } from "@clerk/express";

const routineRouter = express.Router();

routineRouter.get("/", requireAuth(), getUserRoutines);
routineRouter.post("/", requireAuth(), createRoutine);
routineRouter.put("/:id", requireAuth(), updateRoutine);
routineRouter.delete("/:id", requireAuth(), deleteRoutine);

export default routineRouter;
