import express from "express";
import {
  deletePosition,
  getSettings,
  listNearbyUsers,
  updatePosition,
  updateSettings,
} from "../controllers/nearbyController.js";
import { protect } from "../middlewares/auth.js";
import { createLimiter, memberKey } from "../middlewares/rateLimits.js";

const nearbyRouter = express.Router();

/**
 * Position writes get their own budget. The client only sends a fix when the
 * screen opens or the member pulls to refresh, so this is generous for real
 * use and tight enough that an account cannot sweep a city by posting a grid
 * of coordinates.
 */
const positionLimiter = createLimiter({
  name: "nearby-position",
  windowMs: 15 * 60 * 1000,
  limit: 40,
  key: memberKey,
  message: { success: false, message: "Location updates are being sent too often" },
});

/** Listing is cheap but enumerable, so it is capped independently of writes. */
const listLimiter = createLimiter({
  name: "nearby-list",
  windowMs: 15 * 60 * 1000,
  limit: 120,
  key: memberKey,
  message: { success: false, message: "Too many nearby requests; please try again later" },
});

nearbyRouter.get("/settings", protect, getSettings);
nearbyRouter.patch("/settings", protect, updateSettings);
nearbyRouter.put("/position", protect, positionLimiter, updatePosition);
nearbyRouter.delete("/position", protect, deletePosition);
nearbyRouter.get("/users", protect, listLimiter, listNearbyUsers);

export default nearbyRouter;
