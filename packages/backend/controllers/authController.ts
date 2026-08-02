import bcrypt from "bcryptjs";
import type { Request, RequestHandler, Response } from "express";
import type { InternalUser } from "../repositories/entities.js";
import * as authService from "../services/authService.js";
import * as userService from "../services/userService.js";
import {
  clearRefreshCookie,
  createRefreshSession,
  getRefreshTokenFromRequest,
  isMobileAuthClient,
  isMobileRefreshClient,
  revokeRefreshSession,
  rotateRefreshSession,
  setRefreshCookie,
  signAccessToken,
} from "../utils/authTokens.js";
import {
  validateLogin,
  validatePassword,
  validateRegistration,
} from "../utils/authValidation.js";
import sendEmail from "../configs/nodeMailer.js";
import { escapeHtml } from "../utils/html.js";
import { logger, safeErrorMetadata } from "../utils/logger.js";

const publicUser = (user: InternalUser) => ({
  id: user._id,
  _id: user._id,
  email: user.email,
  username: user.username,
  full_name: user.full_name,
  profile_picture: user.profile_picture,
  plan: user.plan,
  bio: user.bio,
  privacy: user.privacy,
});

const sendAuthResponse = async (req: Request, res: Response, user: InternalUser, status = 200) => {
  const refreshToken = await createRefreshSession(user._id.toString(), req);
  const sessionId = refreshToken.slice(0, refreshToken.indexOf("."));
  const access = signAccessToken(user._id.toString(), sessionId);
  const mobileClient = isMobileAuthClient(req);

  if (!mobileClient) setRefreshCookie(res, refreshToken);

  return res.status(status).json({
    success: true,
    user: publicUser(user),
    token: access.token,
    accessTokenExpiresAt: access.expiresAt,
    ...(mobileClient ? { refreshToken } : {}),
  });
};

export const registerUser: RequestHandler = async (req, res, next) => {
  try {
    const { fieldErrors, normalized } = validateRegistration(req.body);
    if (Object.keys(fieldErrors).length > 0) {
      const error = Object.assign(new Error("Invalid registration data"), {
        status: 400,
        fieldErrors,
      });
      return next(error);
    }

    const userExists = await authService.getUserByEmailOrUsername(
      normalized.email,
      normalized.username
    );
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: "Email or username already exists",
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(normalized.password, salt);
    const user = await authService.createUser(
      normalized.email,
      hashedPassword,
      normalized.full_name,
      normalized.username
    );

    return sendAuthResponse(req, res, user, 201);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Email or username already exists",
      });
    }
    return next(error);
  }
};

export const loginUser: RequestHandler = async (req, res, next) => {
  try {
    const { email, password, valid } = validateLogin(req.body);
    if (!valid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const user = await authService.getUserByEmailWithPassword(email);
    if (!user?.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    return sendAuthResponse(req, res, user);
  } catch (error) {
    return next(error);
  }
};

export const refreshSession: RequestHandler = async (req, res, next) => {
  try {
    const rawToken = getRefreshTokenFromRequest(req);
    const rotated = await rotateRefreshSession(rawToken, req);
    if (!rotated) {
      return res.status(401).json({ success: false, message: "Session expired" });
    }

    const user = await userService.getUserById(rotated.userId);
    if (!user) {
      await revokeRefreshSession(rotated.refreshToken);
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, message: "Session expired" });
    }

    const access = signAccessToken(rotated.userId, rotated.sessionId);
    const mobileClient = isMobileRefreshClient(req);
    if (!mobileClient) setRefreshCookie(res, rotated.refreshToken);

    return res.json({
      success: true,
      user: publicUser(user),
      token: access.token,
      accessTokenExpiresAt: access.expiresAt,
      ...(mobileClient ? { refreshToken: rotated.refreshToken } : {}),
    });
  } catch (error) {
    return next(error);
  }
};

export const logoutUser: RequestHandler = async (req, res, next) => {
  try {
    await revokeRefreshSession(getRefreshTokenFromRequest(req));
    clearRefreshCookie(res);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};

export const getMe: RequestHandler = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
};

export const requestPasswordReset: RequestHandler = async (req, res, next) => {
  try {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const genericResponse = {
      success: true,
      message: "If the account exists, a reset link has been sent",
    };
    if (!email || email.length > 254) return res.status(202).json(genericResponse);

    const user = await authService.getUserByEmailWithPassword(email);
    if (!user) return res.status(202).json(genericResponse);
    if (process.env.EMAIL_ENABLED === "false") {
      return res.status(202).json(genericResponse);
    }

    try {
      const token = await authService.createPasswordResetToken(user._id);
      const resetUrl = new URL("/reset-password", process.env.FRONTEND_URL);
      resetUrl.searchParams.set("token", token);
      await sendEmail({
        to: user.email,
        subject: "Reset your MotionMeet password",
        body: `
          <p>Hello ${escapeHtml(user.full_name || user.username)},</p>
          <p>Use the link below to set a new MotionMeet password. The link expires in 30 minutes.</p>
          <p><a href="${escapeHtml(resetUrl.toString())}">Reset password</a></p>
          <p>If you did not request this, you can ignore this email.</p>
        `,
      });
    } catch (error) {
      logger.error("password_reset_delivery_failed", safeErrorMetadata(error));
    }

    return res.status(202).json(genericResponse);
  } catch (error) {
    return next(error);
  }
};

export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    const { password, valid } = validatePassword(req.body?.password);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 10 and 72 UTF-8 bytes",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const passwordUpdated = await authService.resetPasswordWithToken(
      req.body?.token,
      hashedPassword
    );
    if (!passwordUpdated) {
      return res.status(400).json({
        success: false,
        message: "Reset link is invalid or expired",
      });
    }
    clearRefreshCookie(res);
    return res.json({
      success: true,
      message: "Password updated. Sign in again on all devices.",
    });
  } catch (error) {
    return next(error);
  }
};
