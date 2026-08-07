import express from "express";
import rateLimit from "express-rate-limit";
import {
  getAttribution,
  getLocation,
  listCountries,
  listRecentLocations,
  resolveCoordinates,
  searchLocations,
} from "../controllers/locationController.js";
import { protect } from "../middlewares/auth.js";
import { createRateLimitStore } from "../configs/redis.js";

const locationRouter = express.Router();

/**
 * The picker debounces and skips repeat queries, so a well-behaved session
 * spends a handful of requests per search. This ceiling leaves room for fast
 * typing while making a scraper walking the 150k-row city table give up.
 */
const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("location-search"),
  message: { success: false, message: "Too many location searches; please slow down" },
});

/** Attribution is a static string and is public on purpose - see docs/LICENSES.md. */
locationRouter.get("/attribution", getAttribution);

locationRouter.get("/search", protect, searchLimiter, searchLocations);
locationRouter.get("/countries", protect, listCountries);
locationRouter.get("/recent", protect, listRecentLocations);
locationRouter.post("/resolve", protect, searchLimiter, resolveCoordinates);
locationRouter.get("/:kind/:id", protect, getLocation);

export default locationRouter;
