import type { NextFunction, Request, RequestHandler, Response } from "express";
import { findUserById } from "../repositories/userRepository.js";
import { verifyAccessToken } from "../utils/authTokens.js";
import { isUserId } from "../utils/validation.js";

const messageOf = (error: unknown): string => error instanceof Error ? error.message : "Unknown authentication error";

export const protect: RequestHandler = async (request: Request, response: Response, next: NextFunction) => {
  try {
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    if (!token) return void response.status(401).json({ success: false, message: "Not authenticated, no token" });
    const decoded = verifyAccessToken(token);
    if (!isUserId(decoded.id) || !isUserId(decoded.sid)) {
      return void response.status(401).json({ success: false, message: "Not authenticated, token failed" });
    }
    request.userId = decoded.id;
    request.sessionId = decoded.sid;
    next();
  } catch (error: unknown) {
    console.warn("Authentication failed:", messageOf(error));
    response.status(401).json({ success: false, message: "Not authenticated, token failed" });
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
