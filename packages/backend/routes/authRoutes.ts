import express from "express";
import rateLimit from "express-rate-limit";
import {
  registerUser,
  loginUser,
  getMe,
  logoutUser,
  requestPasswordReset,
  resetPassword,
  refreshSession,
} from "../controllers/authController.js";
import { protect } from "../middlewares/auth.js";
import { createRateLimitStore } from "../configs/redis.js";
import { verifyBrowserAuthRequest } from "../middlewares/browserSecurity.js";

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

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("password-reset"),
  message: authLimiterResponse,
});

router.post("/register", registerLimiter, registerUser);
router.post("/login", loginLimiter, loginUser);
router.post("/refresh", verifyBrowserAuthRequest, refreshLimiter, refreshSession);
router.post("/logout", verifyBrowserAuthRequest, logoutUser);
router.post("/forgot-password", passwordResetLimiter, requestPasswordReset);
router.post("/reset-password", passwordResetLimiter, resetPassword);
router.get("/me", protect, getMe);

export default router;
