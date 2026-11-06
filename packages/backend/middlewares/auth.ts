import type { NextFunction, Request, RequestHandler, Response } from "express";
import { isSessionMarkedRevoked } from "../configs/redis.js";
import { findUserById } from "../repositories/userRepository.js";
import { isSessionActive, verifyAccessToken } from "../utils/authTokens.js";
import { logger, safeErrorMetadata } from "../utils/logger.js";
import { isUserId } from "../utils/validation.js";

/**
 * Verifies the access token, then asks Redis whether its session was revoked
 * (logout, password reset, account deletion - D-09 in the 2026-11 audit), so a
 * revoked token stops working at once instead of at the end of its 15 minutes.
 * That costs one `EXISTS`. Without Redis the check is skipped and the token
 * stays valid until it expires; routes that must not accept that use
 * `requireActiveSession` as well.
 */
export const protect: RequestHandler = async (request: Request, response: Response, next: NextFunction) => {
  try {
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    if (!token) return void response.status(401).json({ success: false, message: "Not authenticated, no token" });
    const decoded = verifyAccessToken(token);
    if (!isUserId(decoded.id) || !isUserId(decoded.sid)) {
      return void response.status(401).json({ success: false, message: "Not authenticated, token failed" });
    }
    if (await isSessionMarkedRevoked(decoded.sid)) {
      return void response.status(401).json({ success: false, message: "Session has ended" });
    }
    request.userId = decoded.id;
    request.sessionId = decoded.sid;
    next();
  } catch (error: unknown) {
    // The token itself is never logged.
    logger.warn("authentication_failed", safeErrorMetadata(error));
    response.status(401).json({ success: false, message: "Not authenticated, token failed" });
  }
};

/**
 * After `protect`, on routes where a revoked session must never get through
 * even when Redis is down: account deletion, export, profile and privacy
 * changes. One primary-key read in PostgreSQL.
 */
export const requireActiveSession: RequestHandler = async (request, response, next) => {
  try {
    if (!request.userId || !request.sessionId || !(await isSessionActive(request.sessionId, request.userId))) {
      return void response.status(401).json({ success: false, message: "Session has ended" });
    }
    next();
  } catch (error: unknown) {
    next(error);
  }
};

export const attachDbUser: RequestHandler = async (request, response, next) => {
  try {
    if (!request.userId) return void response.status(401).json({ success: false, message: "Not authenticated" });
    const user = await findUserById(request.userId);
    if (!user) return void response.status(404).json({ success: false, message: "User not found in database" });
    request.dbUser = user;
    next();
  } catch (error: unknown) {
    next(error);
  }
};

export const authorizeRole = (...roles: Array<"user" | "admin" | "superadmin">): RequestHandler =>
  (request, response, next) => {
    if (!request.dbUser) return void response.status(500).json({ success: false, message: "User context not attached" });
    if (request.dbUser.role === "superadmin") return void next();
    if (!roles.includes(request.dbUser.role)) {
      return void response.status(403).json({ success: false, message: "Forbidden: You do not have the required role to access this." });
    }
    next();
  };
