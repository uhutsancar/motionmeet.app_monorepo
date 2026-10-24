import express, { type RequestHandler } from "express";
import { isDevelopmentOrigin, loadEnvironment } from "../configs/environment.js";
import { isMobileRefreshClient } from "../utils/authTokens.js";

const normalizedOrigin = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const requestOrigin = (origin: string | undefined, referer: string | undefined): string | null =>
  normalizedOrigin(origin) ?? normalizedOrigin(referer);

export const isAllowedBrowserOrigin = (
  origin: string | null,
  allowedOrigins: readonly string[],
  allowDevelopmentOrigins: boolean,
): boolean => Boolean(
  origin && (
    allowedOrigins.includes(origin) ||
    (allowDevelopmentOrigins && isDevelopmentOrigin(origin))
  ),
);

/**
 * Refresh/logout use an HttpOnly cookie in browsers. Native clients send the
 * refresh token in the JSON body and therefore do not rely on ambient cookies.
 */
export const verifyBrowserAuthRequest: RequestHandler = (request, response, next) => {
  if (isMobileRefreshClient(request)) return void next();

  const environment = loadEnvironment();
  const origin = requestOrigin(request.get("origin"), request.get("referer"));
  if (!isAllowedBrowserOrigin(origin, environment.corsOrigins, environment.nodeEnv !== "production")) {
    return void response.status(403).json({
      success: false,
      message: "Invalid request origin",
      requestId: request.requestId,
    });
  }
  if (request.get("x-csrf-protection") !== "1") {
    return void response.status(403).json({
      success: false,
      message: "CSRF protection required",
      requestId: request.requestId,
    });
  }
  next();
};

/**
 * JSON request bodies, uncompressed only.
 *
 * body-parser inflates gzip, deflate and Brotli request bodies by default, and
 * it runs before authentication and rate limiting, so any anonymous request
 * could feed the runtime's decompressors directly (CVE-2026-111497 was a
 * Brotli decoder out-of-bounds write). No MotionMeet client compresses what it
 * sends, so a compressed body is answered 415 without being decoded.
 */
export const parseJsonBody = express.json({ limit: "500kb", strict: true, inflate: false });

const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ALLOWED_API_CONTENT_TYPES = new Set(["application/json", "multipart/form-data"]);

/**
 * True when the request declares no entity body at all: `Content-Length: 0` and
 * no chunked encoding that could still carry one.
 *
 * React Native's OkHttp layer stamps `application/x-www-form-urlencoded` on a
 * body-less POST/PUT/PATCH, so the mobile client's idempotent like (`PUT
 * /api/post/:postId/like`, no payload) arrived with a content type the contract
 * below does not allow and was answered 415. There is nothing to reject in a
 * zero-length body, so the declared type is meaningless for these requests.
 */
const declaresNoBody = (request: Parameters<RequestHandler>[0]): boolean =>
  request.get("transfer-encoding") === undefined && request.get("content-length") === "0";

/**
 * MotionMeet's API contract is JSON plus explicit multipart media routes. This
 * rejects simple-form, text and XML bodies before they reach a controller.
 * Empty-body requests remain valid and are still protected by auth/CSRF.
 */
export const rejectUnsupportedApiContentType: RequestHandler = (request, response, next) => {
  if (!BODY_METHODS.has(request.method.toUpperCase())) return void next();
  if (declaresNoBody(request)) return void next();
  const contentType = request.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (!contentType || ALLOWED_API_CONTENT_TYPES.has(contentType)) return void next();
  return void response.status(415).json({
    success: false,
    message: "Unsupported media type",
    requestId: request.requestId,
  });
};
