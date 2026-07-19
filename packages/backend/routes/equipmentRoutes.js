import express from "express";
import { getEquipment } from "../controllers/equipmentController.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

router.get("/", protect, getEquipment);

export default router;
