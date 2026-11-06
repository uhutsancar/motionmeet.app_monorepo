import type { Request, RequestHandler } from "express";
import { contextFromHeaders, runWithContext } from "../observability/context.js";
import { httpRequestDuration, statusClass } from "../observability/metrics.js";
import { logger } from "../utils/logger.js";

/**
 * The route template that served the request (`/api/post/:postId`), never the
 * raw path: a metric label per post id would be a series per post.
 */
const routeTemplate = (request: Request): string => {
  const routePath: unknown = request.route?.path;
  return typeof routePath === "string" ? `${request.baseUrl}${routePath}` : "unmatched";
};

export const requestContext: RequestHandler = (request, response, next) => {
  // A caller's W3C trace is continued and a sane request id is kept, so the
  // mobile app's operation and this server's log lines line up.
  const context = contextFromHeaders({ traceparent: request.get("traceparent"), requestId: request.get("X-Request-Id") });
  const startedAt = process.hrtime.bigint();
  request.requestId = context.requestId;
  request.traceId = context.traceId;
  response.setHeader("X-Request-Id", context.requestId);
  response.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const route = routeTemplate(request);
    httpRequestDuration.observe({ method: request.method, route, status_class: statusClass(response.statusCode) }, durationMs / 1000);
    runWithContext(context, () => logger.info("request_completed", { method: request.method, route, path: request.path, status: response.statusCode, durationMs: Number(durationMs.toFixed(2)) }));
  });
  runWithContext(context, next);
};
