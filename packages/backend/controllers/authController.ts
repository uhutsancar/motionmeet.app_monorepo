import { markSessionsRevoked } from "../configs/redis.js";
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
import { disconnectSessionSockets, disconnectUserSockets } from "../realtime/socketRegistry.js";
import { escapeHtml } from "../utils/html.js";
import { errorDiagnostics, logger } from "../utils/logger.js";
import { hashPassword, verifyPassword } from "../utils/passwordHashing.js";

const publicUser = (user: InternalUser) => ({
  id: user._id,
  _id: user._id,
  email: user.email,
  username: user.username,
  full_name: user.full_name,
  profile_picture: user.profile_picture,
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

    const hashedPassword = await hashPassword(normalized.password);
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
    // Checked even when there is no such account, so the answer takes as long
    // either way and its timing does not tell which addresses are registered.
    if (!(await verifyPassword(password, user?.password)) || !user) {
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
    if (rotated.status === "reused") {
      // A replaced token came back after its grace window: whoever holds the
      // session's current token is cut off as well, sockets and access tokens
      // included. The member signs in again.
      logger.warn("refresh_token_reuse_detected", { sessionId: rotated.sessionId, userId: rotated.userId });
      disconnectSessionSockets(rotated.sessionId);
      await markSessionsRevoked([rotated.sessionId]);
      clearRefreshCookie(res);
    }
    // An unknown token leaves the cookie alone: in a browser it is shared by
    // every tab, and another tab may have just stored a good one in it.
    if (rotated.status !== "rotated") {
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
    const revokedSessionId = await revokeRefreshSession(getRefreshTokenFromRequest(req));
    // Neither a socket nor an access token issued under this session may
    // outlive the logout.
    if (revokedSessionId) {
      disconnectSessionSockets(revokedSessionId);
      await markSessionsRevoked([revokedSessionId]);
    }
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
    // Answered before anything is looked up. Creating the token and talking to
    // SMTP took long enough only for a registered address that the response
    // time said which addresses have an account, and a slow mail server held
    // the request open. A member whose mail is lost asks again.
    res.status(202).json(genericResponse);
    if (!email || email.length > 254 || process.env.EMAIL_ENABLED === "false") return undefined;

    void (async () => {
      const user = await authService.getUserByEmailWithPassword(email);
      if (!user) return;
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
    })().catch((error: unknown) => {
      logger.error("password_reset_delivery_failed", errorDiagnostics(error));
    });
    return undefined;
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
    // The token is checked before the password is hashed: hashing is the
    // expensive part, and a request without a live token must not cost it.
    if (!(await authService.isResetTokenRedeemable(req.body?.token))) {
      return res.status(400).json({
        success: false,
        message: "Reset link is invalid or expired",
      });
    }
    const hashedPassword = await hashPassword(password);
    // Redeemed atomically here; a concurrent redemption of the same token
    // makes this one answer as an invalid link.
    const passwordOwner = await authService.resetPasswordWithToken(
      req.body?.token,
      hashedPassword
    );
    if (!passwordOwner) {
      return res.status(400).json({
        success: false,
        message: "Reset link is invalid or expired",
      });
    }
    // Every session was revoked with the password; open sockets go with them.
    disconnectUserSockets(passwordOwner);
    clearRefreshCookie(res);
    return res.json({
      success: true,
      message: "Password updated. Sign in again on all devices.",
    });
  } catch (error) {
    return next(error);
  }
};
