import express from "express";
import rateLimit from "express-rate-limit";
import {
  registerUser,
  loginUser,
  getMe,
  logoutUser,
  refreshSession,
} from "../controllers/authController.js";
import { protect } from "../middlewares/auth.js";
import { createRateLimitStore } from "../configs/redis.js";

const router = express.Router();

const authLimiterResponse = {
  success: false,
  message: "Too many authentication attempts; please try again later",
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("login"),
  skipSuccessfulRequests: true,
  message: authLimiterResponse,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("register"),
  message: authLimiterResponse,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("refresh"),
  message: authLimiterResponse,
});

router.post("/register", registerLimiter, registerUser);
router.post("/login", loginLimiter, loginUser);
router.post("/refresh", refreshLimiter, refreshSession);
router.post("/logout", logoutUser);
router.get("/me", protect, getMe);

export default router;
