import express from "express";
import rateLimit from "express-rate-limit";
import {
  deletePosition,
  getSettings,
  listNearbyUsers,
  updatePosition,
  updateSettings,
} from "../controllers/nearbyController.js";
import { protect } from "../middlewares/auth.js";
import { createRateLimitStore } from "../configs/redis.js";

const nearbyRouter = express.Router();

/**
 * Position writes get their own budget. The client only sends a fix when the
 * screen opens or the member pulls to refresh, so this is generous for real
 * use and tight enough that an account cannot sweep a city by posting a grid
 * of coordinates.
 */
const positionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("nearby-position"),
  message: { success: false, message: "Location updates are being sent too often" },
});

/** Listing is cheap but enumerable, so it is capped independently of writes. */
const listLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("nearby-list"),
  message: { success: false, message: "Too many nearby requests; please try again later" },
});

nearbyRouter.get("/settings", protect, getSettings);
nearbyRouter.patch("/settings", protect, updateSettings);
nearbyRouter.put("/position", protect, positionLimiter, updatePosition);
nearbyRouter.delete("/position", protect, deletePosition);
nearbyRouter.get("/users", protect, listLimiter, listNearbyUsers);

export default nearbyRouter;
