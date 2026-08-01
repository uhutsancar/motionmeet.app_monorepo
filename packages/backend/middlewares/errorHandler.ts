import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../utils/logger.js";
interface HttpError extends Error { status?: number; statusCode?: number; code?: string; fieldErrors?: Record<string, string>; fields?: Record<string, string> }
const asHttpError = (value: unknown): HttpError => value instanceof Error ? value as HttpError : Object.assign(new Error("Unknown error"), { cause: value });
export const notFoundHandler: RequestHandler = (request, response) => { response.status(404).json({ success: false, message: `Route not found: ${request.method} ${request.originalUrl}`, requestId: request.requestId }); };
export const errorHandler: ErrorRequestHandler = (value, request, response, _next) => {
  const error = asHttpError(value); const requested = error.status ?? error.statusCode ?? 500; const status = Number.isInteger(requested) && requested >= 400 && requested <= 599 ? requested : error.code === "23505" ? 409 : 500;
  logger.error("request_failed", { requestId: request.requestId, method: request.method, path: request.path, status, code: error.code, message: error.message, ...(process.env.NODE_ENV !== "production" ? { stack: error.stack } : {}) });
  const safeMessages: Record<number, string> = { 400: "Invalid request", 401: "Authentication required", 403: "Forbidden", 404: "Not found", 409: "The request conflicts with existing data", 413: "Request is too large", 415: "Unsupported media type", 429: "Too many requests", 503: "Service temporarily unavailable" };
  const publicMessage = status < 500 && error.message ? error.message : safeMessages[status] ?? "Internal server error";
  response.status(status).json({ success: false, message: publicMessage, requestId: request.requestId, ...(error.fieldErrors || error.fields ? { fields: error.fieldErrors ?? error.fields } : {}) });
};
