import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../utils/logger.js";
interface HttpError extends Error { status?: number; statusCode?: number; code?: string; type?: string; fieldErrors?: Record<string, string>; fields?: Record<string, string> }
const asHttpError = (value: unknown): HttpError => value instanceof Error ? value as HttpError : Object.assign(new Error("Unknown error"), { cause: value });

const safeMessages: Record<number, string> = { 400: "Invalid request", 401: "Authentication required", 403: "Forbidden", 404: "Not found", 409: "The request conflicts with existing data", 413: "Request is too large", 415: "Unsupported media type", 429: "Too many requests", 503: "Service temporarily unavailable" };

export interface PublicErrorDetails {
  error: HttpError;
  status: number;
  message: string;
  fields?: Record<string, string>;
}

export const toPublicError = (value: unknown): PublicErrorDetails => {
  const error = asHttpError(value);
  const explicitStatus = error.status ?? error.statusCode;
  const hasExplicitStatus = Number.isInteger(explicitStatus) && Number(explicitStatus) >= 400 && Number(explicitStatus) <= 599;
  const status = hasExplicitStatus ? Number(explicitStatus) : error.code === "23505" ? 409 : 500;
  const parserGeneratedError = typeof error.type === "string" && error.type.startsWith("entity.");
  const mayExposeApplicationMessage = hasExplicitStatus && status < 500 && !parserGeneratedError;
  return {
    error,
    status,
    message: mayExposeApplicationMessage && error.message ? error.message : safeMessages[status] ?? "Internal server error",
    ...(error.fieldErrors || error.fields ? { fields: error.fieldErrors ?? error.fields } : {}),
  };
};

export const notFoundHandler: RequestHandler = (request, response) => { response.status(404).json({ success: false, message: "Not found", requestId: request.requestId }); };
export const errorHandler: ErrorRequestHandler = (value, request, response, _next) => {
  const mapped = toPublicError(value); const { error, status } = mapped;
  logger.error("request_failed", { requestId: request.requestId, method: request.method, path: request.path, status, code: error.code, ...(process.env.NODE_ENV !== "production" ? { message: error.message, stack: error.stack } : {}) });
  response.status(status).json({ success: false, message: mapped.message, requestId: request.requestId, ...(mapped.fields ? { fields: mapped.fields } : {}) });
};
