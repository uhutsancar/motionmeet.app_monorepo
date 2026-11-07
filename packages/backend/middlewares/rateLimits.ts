import crypto from "node:crypto";
import type { Request, RequestHandler } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { createRateLimitStore } from "../configs/redis.js";
import { getRefreshTokenFromRequest, verifyAccessToken } from "../utils/authTokens.js";
import { isUserId, UUID_PATTERN } from "../utils/validation.js";

/**
 * Who a request is counted against.
 *
 * Every limiter used to count by `request.ip` alone. Two things made that
 * wrong in production:
 *
 * - Behind a TLS proxy and nginx, `trust proxy 1` resolved every request to
 *   the TLS proxy's address, so each limit was one budget for the whole
 *   world - ten mistyped passwords anywhere locked everybody out. The address
 *   now comes from `TRUST_PROXY` (configs/environment.ts).
 * - Even with the right address, mobile carriers put thousands of members
 *   behind one address (CGNAT). Requests that carry an identity are counted
 *   against it instead: the member after `protect`, the session for a token
 *   refresh, the address and the e-mail address together for a login.
 */

/** The client's address as the trusted proxies report it, IPv6 grouped by /56. */
export const clientKey = (request: Request): string => `ip:${ipKeyGenerator(request.ip ?? "unknown")}`;

/** After `protect`: the signed-in member. */
export const memberKey = (request: Request): string => (request.userId ? `user:${request.userId}` : clientKey(request));

/**
 * Ahead of `protect` (the global API budget): the member a valid access token
 * names, otherwise the address. Verifying an HS256 token is a few
 * microseconds; an invalid one simply counts against the address.
 */
export const bearerOrClientKey = (request: Request): string => {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith("Bearer ") && authorization.length < 10_000) {
    try {
      const claims = verifyAccessToken(authorization.slice(7));
      if (isUserId(claims.id)) return `user:${claims.id}`;
    } catch {
      // Expired or forged: the address pays for it.
    }
  }
  return clientKey(request);
};

/** The e-mail address, hashed so the limiter store never holds it. */
const emailDigest = (value: unknown): string =>
  crypto.createHash("sha256").update(typeof value === "string" ? value.trim().toLowerCase() : "").digest("hex").slice(0, 32);

/** One address trying one account: members behind the same NAT do not share it. */
export const clientAndEmailKey = (request: Request): string => {
  const body = typeof request.body === "object" && request.body !== null ? request.body as Record<string, unknown> : {};
  return `${clientKey(request)}:email:${emailDigest(body.email)}`;
};

/**
 * A refresh counts against its session. The id is only the token's prefix
 * and proves nothing; a made-up one costs one primary-key miss and is still
 * under the address-wide API budget.
 */
export const refreshSessionKey = (request: Request): string => {
  const token = getRefreshTokenFromRequest(request);
  const sessionId = token?.slice(0, token.indexOf("."));
  return sessionId && UUID_PATTERN.test(sessionId) ? `session:${sessionId.toLowerCase()}` : clientKey(request);
};

interface LimiterOptions {
  /** Names the store's Redis prefix; changing it resets the counters. */
  name: string;
  windowMs: number;
  limit: number;
  message: string | Record<string, unknown>;
  key: (request: Request) => string;
  /** Count only failures (a login that succeeded does not use up the budget). */
  skipSuccessfulRequests?: boolean;
}

export const createLimiter = ({ name, windowMs, limit, message, key, skipSuccessfulRequests = false }: LimiterOptions): RequestHandler => rateLimit({
  windowMs,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore(name),
  keyGenerator: (request) => key(request),
  skipSuccessfulRequests,
  message,
});

/**
 * Multipart uploads read whole files into memory, and share cards are
 * rasterised by sharp on libuv's thread pool - the one DNS lookups and file
 * reads also wait on. Neither had a budget of its own beyond the API-wide one.
 * One limiter each, shared by every route of its kind.
 */
export const multipartUploadLimiter = createLimiter({
  name: "multipart-upload",
  windowMs: 15 * 60 * 1000,
  limit: 60,
  key: memberKey,
  message: { success: false, message: "Too many uploads; please try again later" },
});

export const shareCardLimiter = createLimiter({
  name: "share-card",
  windowMs: 15 * 60 * 1000,
  limit: 60,
  key: memberKey,
  message: { success: false, message: "Too many share cards; please try again later" },
});
