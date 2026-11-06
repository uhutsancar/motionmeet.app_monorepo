import { createServer, type Server } from "node:http";
import { logger, safeErrorMetadata } from "../utils/logger.js";
import { registry } from "./metrics.js";

export interface ReadinessReport {
  ready: boolean;
  [detail: string]: unknown;
}

/**
 * The private operations listener: `/metrics`, `/health/live`, `/health/ready`.
 *
 * Separate from the public HTTP port on purpose. Metrics describe internals
 * (queue depths, pool usage, route timings) that are nobody's business outside
 * the deployment, so they are bound to a port that the reverse proxy never
 * routes and the compose files keep on the private network. Workers and the
 * scheduler have no public port at all, so this is also how their health is
 * probed.
 */
export const startOpsServer = (port: number, readiness: () => Promise<ReadinessReport>): Server => {
  const server = createServer((request, response) => {
    const path = (request.url ?? "/").split("?")[0];
    if (request.method !== "GET") {
      response.writeHead(405).end();
      return;
    }
    if (path === "/metrics") {
      registry.metrics().then(
        (body) => response.writeHead(200, { "Content-Type": registry.contentType }).end(body),
        (error: unknown) => {
          logger.error("metrics_render_failed", safeErrorMetadata(error));
          response.writeHead(500).end();
        },
      );
      return;
    }
    if (path === "/health/live") {
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ status: "ok", uptimeSeconds: Math.floor(process.uptime()) }));
      return;
    }
    if (path === "/health/ready") {
      readiness().then(
        (report) => response.writeHead(report.ready ? 200 : 503, { "Content-Type": "application/json" }).end(JSON.stringify({ status: report.ready ? "ready" : "not-ready", ...report })),
        () => response.writeHead(503, { "Content-Type": "application/json" }).end(JSON.stringify({ status: "not-ready" })),
      );
      return;
    }
    response.writeHead(404).end();
  });
  server.on("error", (error) => logger.error("ops_server_error", { port, ...safeErrorMetadata(error) }));
  server.listen(port, "0.0.0.0", () => logger.info("ops_server_listening", { port }));
  return server;
};
