import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Session from "../models/Session.js";

const ACCESS_TOKEN_ISSUER = "motionmeet-api";
const ACCESS_TOKEN_AUDIENCE = "motionmeet-clients";
const REFRESH_TOKEN_DAYS = 30;
const REFRESH_COOKIE_NAME = "motionmeet_refresh";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("JWT_SECRET is required");
  return secret;
};

const hashSecret = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const createRefreshSecret = () => crypto.randomBytes(48).toString("base64url");

const parseRefreshToken = (token) => {
  if (typeof token !== "string" || token.length > 512) return null;
  const separator = token.indexOf(".");
  if (separator <= 0) return null;

  const sessionId = token.slice(0, separator);
  const secret = token.slice(separator + 1);
  if (!mongoose.isObjectIdOrHexString(sessionId) || secret.length < 32) return null;
  return { sessionId, secret };
};

const refreshExpiry = () =>
  new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

const serializeRefreshToken = (sessionId, secret) => `${sessionId}.${secret}`;

export const signAccessToken = (userId, sessionId) => {
  const token = jwt.sign(
    { id: userId, sid: sessionId },
    getJwtSecret(),
    {
      algorithm: "HS256",
      audience: ACCESS_TOKEN_AUDIENCE,
      expiresIn: "15m",
      issuer: ACCESS_TOKEN_ISSUER,
    }
  );
  const decoded = jwt.decode(token);
  return {
    token,
    expiresAt: typeof decoded?.exp === "number" ? decoded.exp * 1000 : Date.now() + 15 * 60 * 1000,
  };
};

export const verifyAccessToken = (token) =>
  jwt.verify(token, getJwtSecret(), {
    algorithms: ["HS256"],
    audience: ACCESS_TOKEN_AUDIENCE,
    issuer: ACCESS_TOKEN_ISSUER,
  });

export const createRefreshSession = async (userId, req) => {
  const secret = createRefreshSecret();
  const session = await Session.create({
    userId,
    tokenHash: hashSecret(secret),
    expiresAt: refreshExpiry(),
    userAgent: String(req.get("user-agent") || "").slice(0, 512),
    ipAddress: String(req.ip || "").slice(0, 128),
  });

  return serializeRefreshToken(session._id.toString(), secret);
};

export const rotateRefreshSession = async (rawToken, req) => {
  const parsed = parseRefreshToken(rawToken);
  if (!parsed) return null;

  const nextSecret = createRefreshSecret();
  const session = await Session.findOneAndUpdate(
    {
      _id: parsed.sessionId,
      tokenHash: hashSecret(parsed.secret),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        tokenHash: hashSecret(nextSecret),
        expiresAt: refreshExpiry(),
        lastUsedAt: new Date(),
        userAgent: String(req.get("user-agent") || "").slice(0, 512),
        ipAddress: String(req.ip || "").slice(0, 128),
      },
    },
    { new: true }
  );
  if (!session) return null;

  return {
    userId: session.userId,
    sessionId: session._id.toString(),
    refreshToken: serializeRefreshToken(session._id.toString(), nextSecret),
  };
};

export const revokeRefreshSession = async (rawToken) => {
  const parsed = parseRefreshToken(rawToken);
  if (!parsed) return;
  await Session.updateOne(
    { _id: parsed.sessionId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};

export const getRefreshTokenFromRequest = (req) => {
  if (typeof req.body?.refreshToken === "string") return req.body.refreshToken;

  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader !== "string") return null;
  for (const pair of cookieHeader.split(";")) {
    const [name, ...valueParts] = pair.trim().split("=");
    if (name === REFRESH_COOKIE_NAME) {
      return decodeURIComponent(valueParts.join("="));
    }
  }
  return null;
};

export const setRefreshCookie = (res, refreshToken) => {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    path: "/api/auth",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
};

export const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    path: "/api/auth",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
};

export const isMobileAuthClient = (req) =>
  req.get("x-client-platform") === "mobile";

export const isMobileRefreshClient = (req) =>
  isMobileAuthClient(req) && typeof req.body?.refreshToken === "string";
