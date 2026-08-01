import crypto from "node:crypto";
import type { Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { database } from "../configs/database.js";
import { loadEnvironment } from "../configs/environment.js";

const ACCESS_TOKEN_ISSUER = "motionmeet-api";
const ACCESS_TOKEN_AUDIENCE = "motionmeet-clients";
const REFRESH_TOKEN_DAYS = 30;
const REFRESH_COOKIE_NAME = "motionmeet_refresh";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const hashSecret = (value: string): string => crypto.createHash("sha256").update(value).digest("hex");
const createRefreshSecret = (): string => crypto.randomBytes(48).toString("base64url");

interface ParsedRefreshToken { sessionId: string; secret: string }

const parseRefreshToken = (token: unknown): ParsedRefreshToken | null => {
  if (typeof token !== "string" || token.length > 512) return null;
  const separator = token.indexOf(".");
  if (separator <= 0) return null;
  const sessionId = token.slice(0, separator);
  const secret = token.slice(separator + 1);
  return UUID_PATTERN.test(sessionId) && secret.length >= 32 ? { sessionId, secret } : null;
};

const refreshExpiry = (): Date => new Date(Date.now() + REFRESH_TOKEN_DAYS * 86_400_000);
const serializeRefreshToken = (sessionId: string, secret: string): string => `${sessionId}.${secret}`;

export interface AccessClaims extends JwtPayload { id: string; sid: string }

export const signAccessToken = (userId: string, sessionId: string): { token: string; expiresAt: number } => {
  const token = jwt.sign({ id: userId, sid: sessionId }, loadEnvironment().jwtSecret, {
    algorithm: "HS256", audience: ACCESS_TOKEN_AUDIENCE, expiresIn: "15m", issuer: ACCESS_TOKEN_ISSUER,
  });
  const decoded = jwt.decode(token);
  return { token, expiresAt: typeof decoded === "object" && typeof decoded?.exp === "number" ? decoded.exp * 1000 : Date.now() + 900_000 };
};

export const verifyAccessToken = (token: string): AccessClaims => {
  const decoded = jwt.verify(token, loadEnvironment().jwtSecret, {
    algorithms: ["HS256"], audience: ACCESS_TOKEN_AUDIENCE, issuer: ACCESS_TOKEN_ISSUER,
  });
  if (typeof decoded === "string" || typeof decoded.id !== "string" || typeof decoded.sid !== "string") {
    throw new Error("Access token payload is invalid");
  }
  return decoded as AccessClaims;
};

export const createRefreshSession = async (userId: string, request: Request): Promise<string> => {
  const secret = createRefreshSecret();
  const session = await database.insertInto("sessions").values({
    legacy_mongo_id: null, user_id: userId, token_hash: hashSecret(secret), expires_at: refreshExpiry(),
    revoked_at: null, user_agent: String(request.get("user-agent") ?? "").slice(0, 512),
    ip_address: String(request.ip ?? "").slice(0, 128),
  }).returning("id").executeTakeFirstOrThrow();
  return serializeRefreshToken(session.id, secret);
};

export interface RotatedSession { userId: string; sessionId: string; refreshToken: string }

export const rotateRefreshSession = async (rawToken: unknown, request: Request): Promise<RotatedSession | null> => {
  const parsed = parseRefreshToken(rawToken);
  if (!parsed) return null;
  const nextSecret = createRefreshSecret();
  const session = await database.updateTable("sessions").set({
    token_hash: hashSecret(nextSecret), expires_at: refreshExpiry(), last_used_at: new Date(),
    user_agent: String(request.get("user-agent") ?? "").slice(0, 512), ip_address: String(request.ip ?? "").slice(0, 128),
  }).where("id", "=", parsed.sessionId).where("token_hash", "=", hashSecret(parsed.secret))
    .where("revoked_at", "is", null).where("expires_at", ">", new Date())
    .returning(["id", "user_id"]).executeTakeFirst();
  if (!session) return null;
  return { userId: session.user_id, sessionId: session.id, refreshToken: serializeRefreshToken(session.id, nextSecret) };
};

export const revokeRefreshSession = async (rawToken: unknown): Promise<void> => {
  const parsed = parseRefreshToken(rawToken);
  if (!parsed) return;
  await database.updateTable("sessions").set({ revoked_at: new Date() }).where("id", "=", parsed.sessionId)
    .where("token_hash", "=", hashSecret(parsed.secret)).where("revoked_at", "is", null).execute();
};

export const getRefreshTokenFromRequest = (request: Request): string | null => {
  const body = typeof request.body === "object" && request.body !== null ? request.body as Record<string, unknown> : {};
  if (typeof body.refreshToken === "string") return body.refreshToken;
  const cookieHeader = request.headers.cookie;
  if (typeof cookieHeader !== "string") return null;
  for (const pair of cookieHeader.split(";")) {
    const [name, ...valueParts] = pair.trim().split("=");
    if (name === REFRESH_COOKIE_NAME) return decodeURIComponent(valueParts.join("="));
  }
  return null;
};

const cookieOptions = { httpOnly: true, maxAge: REFRESH_TOKEN_DAYS * 86_400_000, path: "/api/auth", sameSite: "lax" as const, secure: loadEnvironment().nodeEnv === "production" };
export const setRefreshCookie = (response: Response, refreshToken: string): void => { response.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions); };
export const clearRefreshCookie = (response: Response): void => { response.clearCookie(REFRESH_COOKIE_NAME, cookieOptions); };
export const isMobileAuthClient = (request: Request): boolean => request.get("x-client-platform") === "mobile";
export const isMobileRefreshClient = (request: Request): boolean => {
  const body = typeof request.body === "object" && request.body !== null ? request.body as Record<string, unknown> : {};
  return isMobileAuthClient(request) && typeof body.refreshToken === "string";
};
