import express from "express";
import { protect } from "../middlewares/auth.js";
import { listMyMeasurements, saveMyMeasurement, deleteMyMeasurement } from "../controllers/measurementController.js";

const measurementRouter = express.Router();

measurementRouter.get("/", protect, listMyMeasurements);
measurementRouter.post("/", protect, saveMyMeasurement);
measurementRouter.delete("/:measurementId", protect, deleteMyMeasurement);

export default measurementRouter;
