import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { logger } from "../utils/logger.js";
export const requestContext: RequestHandler = (request, response, next) => {
  const requestId = randomUUID(); const startedAt = process.hrtime.bigint();
  request.requestId = requestId; response.setHeader("X-Request-Id", requestId);
  response.once("finish", () => logger.info("request_completed", { requestId, method: request.method, path: request.path, status: response.statusCode, durationMs: Number((Number(process.hrtime.bigint() - startedAt) / 1_000_000).toFixed(2)) }));
  next();
};
