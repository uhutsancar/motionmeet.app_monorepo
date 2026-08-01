import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { logger } from "../utils/logger.js";
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;
export const requestContext: RequestHandler = (request, response, next) => {
  const supplied = request.get("x-request-id"); const requestId = typeof supplied === "string" && REQUEST_ID_PATTERN.test(supplied) ? supplied : randomUUID(); const startedAt = process.hrtime.bigint();
  request.requestId = requestId; response.setHeader("X-Request-Id", requestId);
  response.once("finish", () => logger.info("request_completed", { requestId, method: request.method, path: request.path, status: response.statusCode, durationMs: Number((Number(process.hrtime.bigint() - startedAt) / 1_000_000).toFixed(2)) }));
  next();
};
