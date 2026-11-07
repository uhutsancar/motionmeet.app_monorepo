import express from "express";
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
import { verifyBrowserAuthRequest } from "../middlewares/browserSecurity.js";
import { clientAndEmailKey, clientKey, createLimiter, refreshSessionKey } from "../middlewares/rateLimits.js";

const router = express.Router();

const authLimiterResponse = {
  success: false,
  message: "Too many authentication attempts; please try again later",
};

/**
 * Failed logins are counted per address *and* account, so one member's typos
 * never lock out the others behind the same carrier NAT. The looser
 * address-wide budget is what stops one address from walking many accounts.
 */
const loginLimiter = createLimiter({
  name: "login",
  windowMs: 15 * 60 * 1000,
  limit: 10,
  key: clientAndEmailKey,
  skipSuccessfulRequests: true,
  message: authLimiterResponse,
});

const loginAddressLimiter = createLimiter({
  name: "login-address",
  windowMs: 15 * 60 * 1000,
  limit: 100,
  key: clientKey,
  skipSuccessfulRequests: true,
  message: authLimiterResponse,
});

const registerLimiter = createLimiter({
  name: "register",
  windowMs: 60 * 60 * 1000,
  limit: 10,
  key: clientKey,
  message: authLimiterResponse,
});

const refreshLimiter = createLimiter({
  name: "refresh",
  windowMs: 15 * 60 * 1000,
  limit: 60,
  key: refreshSessionKey,
  message: authLimiterResponse,
});

const passwordResetRequestLimiter = createLimiter({
  name: "password-reset",
  windowMs: 60 * 60 * 1000,
  limit: 5,
  key: clientAndEmailKey,
  message: authLimiterResponse,
});

const passwordResetAddressLimiter = createLimiter({
  name: "password-reset-address",
  windowMs: 60 * 60 * 1000,
  limit: 30,
  key: clientKey,
  message: authLimiterResponse,
});

router.post("/register", registerLimiter, registerUser);
router.post("/login", loginAddressLimiter, loginLimiter, loginUser);
router.post("/refresh", verifyBrowserAuthRequest, refreshLimiter, refreshSession);
router.post("/logout", verifyBrowserAuthRequest, logoutUser);
router.post("/forgot-password", passwordResetAddressLimiter, passwordResetRequestLimiter, requestPasswordReset);
router.post("/reset-password", passwordResetAddressLimiter, resetPassword);
router.get("/me", protect, getMe);

export default router;
