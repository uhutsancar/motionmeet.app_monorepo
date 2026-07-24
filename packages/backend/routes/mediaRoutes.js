import express from "express";
import rateLimit from "express-rate-limit";
import { presignMediaUpload } from "../controllers/mediaController.js";
import { createRateLimitStore } from "../configs/redis.js";
import { protect } from "../middlewares/auth.js";

const mediaRouter = express.Router();
const presignLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("media-presign"),
  message: { success: false, message: "Too many upload requests" },
});

mediaRouter.post("/presign", protect, presignLimiter, presignMediaUpload);

export default mediaRouter;
