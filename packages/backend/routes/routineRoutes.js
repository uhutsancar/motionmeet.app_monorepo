import express from "express";
import { getUserRoutines, createRoutine, updateRoutine, deleteRoutine } from "../controllers/routineController.js";
import { protect, attachDbUser } from "../middlewares/auth.js";

const routineRouter = express.Router();

routineRouter.get("/", protect, getUserRoutines);
routineRouter.post("/", protect, attachDbUser, createRoutine);
routineRouter.put("/:id", protect, attachDbUser, updateRoutine);
routineRouter.delete("/:id", protect, attachDbUser, deleteRoutine);

export default routineRouter;
