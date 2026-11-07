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

/**
 * How long a refresh token that has just been rotated away still yields its
 * successor. Long enough for a mobile client to retry after the response was
 * lost, or for a second browser tab whose refresh raced the first.
 */
export const REFRESH_REUSE_GRACE_MS = 60_000;

/**
 * The successor of a refresh secret: derived from it with a key only the
 * server holds, instead of drawn at random. Presenting the same token twice
 * within the grace window therefore yields the same new token, without the
 * server ever storing a token in a form that could be handed out again.
 */
const successorSecret = (sessionId: string, secret: string): string => {
  const rotationKey = crypto.createHmac("sha256", loadEnvironment().jwtSecret).update("motionmeet refresh rotation v1").digest();
  return crypto.createHmac("sha256", rotationKey).update(`${sessionId}.${secret}`).digest("base64url");
};

export type RefreshOutcome =
  | { status: "rotated"; userId: string; sessionId: string; refreshToken: string }
  /** A token rotated away before the grace window was presented: the session is revoked now. */
  | { status: "reused"; userId: string; sessionId: string }
  | { status: "invalid" };

const clientDetails = (request: Request) => ({
  user_agent: String(request.get("user-agent") ?? "").slice(0, 512),
  ip_address: String(request.ip ?? "").slice(0, 128),
});

/**
 * Exchanges a refresh token for its successor.
 *
 * 1. The session's current token: rotated. Its hash moves to
 *    `previous_token_hash`, the successor's becomes `token_hash`.
 * 2. The token rotated away last, within `REFRESH_REUSE_GRACE_MS`: the same
 *    successor again, and nothing changes. A refresh whose response never
 *    arrived, or two tabs refreshing at once, no longer sign the member out.
 *    Concurrent requests serialise on the row in step 1; the loser finds the
 *    committed rotation here.
 * 3. That previous token after the window: somebody kept a token that was
 *    already replaced - a stolen copy, or a client that lost track. The whole
 *    session is revoked, so whoever holds the current token is cut off too.
 *
 * Anything older than the previous token is simply unknown (`invalid`).
 */
export const rotateRefreshSession = async (rawToken: unknown, request: Request): Promise<RefreshOutcome> => {
  const parsed = parseRefreshToken(rawToken);
  if (!parsed) return { status: "invalid" };
  const presentedHash = hashSecret(parsed.secret);
  const nextSecret = successorSecret(parsed.sessionId, parsed.secret);
  const nextHash = hashSecret(nextSecret);
  const now = new Date();
  const rotated = await database.updateTable("sessions").set({
    previous_token_hash: presentedHash, token_hash: nextHash, rotated_at: now,
    expires_at: refreshExpiry(), last_used_at: now, ...clientDetails(request),
  }).where("id", "=", parsed.sessionId).where("token_hash", "=", presentedHash)
    .where("revoked_at", "is", null).where("expires_at", ">", now)
    .returning(["id", "user_id"]).executeTakeFirst();
  if (rotated) return { status: "rotated", userId: rotated.user_id, sessionId: rotated.id, refreshToken: serializeRefreshToken(rotated.id, nextSecret) };

  const superseded = await database.selectFrom("sessions").select(["id", "user_id", "token_hash", "rotated_at", "revoked_at", "expires_at"])
    .where("id", "=", parsed.sessionId).where("previous_token_hash", "=", presentedHash).executeTakeFirst();
  if (!superseded || superseded.revoked_at || superseded.expires_at <= now) return { status: "invalid" };
  // A successor that does not match means the rotation key changed (a new
  // JWT_SECRET) since: the token cannot be followed, but it was not misused.
  if (superseded.token_hash !== nextHash) return { status: "invalid" };
  if (superseded.rotated_at && now.getTime() - superseded.rotated_at.getTime() <= REFRESH_REUSE_GRACE_MS) {
    return { status: "rotated", userId: superseded.user_id, sessionId: superseded.id, refreshToken: serializeRefreshToken(superseded.id, nextSecret) };
  }
  const revoked = await database.updateTable("sessions").set({ revoked_at: now })
    .where("id", "=", superseded.id).where("revoked_at", "is", null).returning("id").executeTakeFirst();
  return revoked ? { status: "reused", userId: superseded.user_id, sessionId: superseded.id } : { status: "invalid" };
};

/**
 * Revokes the session the refresh token names; returns its id when one was
 * actually revoked. The token rotated away last counts too: a client signing
 * out from inside the grace window still holds proof of the session.
 */
export const revokeRefreshSession = async (rawToken: unknown): Promise<string | null> => {
  const parsed = parseRefreshToken(rawToken);
  if (!parsed) return null;
  const presentedHash = hashSecret(parsed.secret);
  const revoked = await database.updateTable("sessions").set({ revoked_at: new Date() }).where("id", "=", parsed.sessionId)
    .where((expression) => expression.or([expression("token_hash", "=", presentedHash), expression("previous_token_hash", "=", presentedHash)]))
    .where("revoked_at", "is", null).returning("id").executeTakeFirst();
  return revoked?.id ?? null;
};

/**
 * Whether a session still stands: not revoked, not expired, and the user's.
 *
 * Access tokens are stateless for fifteen minutes, which bounds an HTTP
 * client after logout. A socket is different - it authenticates once and can
 * stay open for days - so the realtime layer asks this at the handshake and
 * again periodically, rather than trusting a token it checked long ago.
 */
export const isSessionActive = async (sessionId: string, userId: string): Promise<boolean> =>
  Boolean(await database.selectFrom("sessions").select("id").where("id", "=", sessionId).where("user_id", "=", userId)
    .where("revoked_at", "is", null).where("expires_at", ">", new Date()).executeTakeFirst());

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
