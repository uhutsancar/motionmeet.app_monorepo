import client from "prom-client";
import { loadEnvironment } from "../configs/environment.js";

/**
 * Process metrics, in Prometheus format.
 *
 * Labels are kept to bounded sets - route templates, event types, consumer
 * names, outcome words - never user ids, post ids, raw paths or object keys,
 * which would turn every series into one per member and swamp the store.
 * The registry is served only on the private ops port (see opsServer.ts).
 */
export const registry = new client.Registry();
registry.setDefaultLabels({ role: loadEnvironment().processRole });
// Event-loop lag, heap, GC pauses, RSS, handles: the runtime half of every
// latency question.
client.collectDefaultMetrics({ register: registry, prefix: "motionmeet_" });

export const httpRequestDuration = new client.Histogram({
  name: "motionmeet_http_request_duration_seconds",
  help: "HTTP request duration by route template and status class.",
  labelNames: ["method", "route", "status_class"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const outboxPublished = new client.Counter({
  name: "motionmeet_outbox_events_total",
  help: "Outbox events leaving PostgreSQL, by transport and outcome.",
  labelNames: ["transport", "event_type", "outcome"] as const,
  registers: [registry],
});

export const outboxPublishDuration = new client.Histogram({
  name: "motionmeet_outbox_publish_batch_seconds",
  help: "Time to publish one claimed outbox batch, confirms included.",
  labelNames: ["transport"] as const,
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const eventsConsumed = new client.Counter({
  name: "motionmeet_events_consumed_total",
  help: "Events handled by a consumer, by outcome (applied, duplicate, retried, dead).",
  labelNames: ["consumer", "outcome"] as const,
  registers: [registry],
});

export const eventHandleDuration = new client.Histogram({
  name: "motionmeet_event_handle_seconds",
  help: "Time a consumer spent applying one event.",
  labelNames: ["consumer"] as const,
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [registry],
});

export const scheduledTaskRuns = new client.Counter({
  name: "motionmeet_scheduled_task_runs_total",
  help: "Scheduled task runs, by outcome (ran, skipped_locked, failed).",
  labelNames: ["task", "outcome"] as const,
  registers: [registry],
});

export const scheduledTaskDuration = new client.Histogram({
  name: "motionmeet_scheduled_task_seconds",
  help: "Duration of scheduled task runs that held the lock.",
  labelNames: ["task"] as const,
  buckets: [0.01, 0.1, 0.5, 1, 5, 15, 60, 300],
  registers: [registry],
});

/**
 * Owner-cache invalidations that still failed after their retries. Each one
 * means some cached page may stay stale until its own TTL (feed 30 s, nearby
 * 45 s, profile 60 s); see D-10 in the 2026-11 audit.
 */
export const cacheInvalidationFailures = new client.Counter({
  name: "motionmeet_cache_invalidation_failures_total",
  help: "Cache invalidations that failed after every retry.",
  registers: [registry],
});

/**
 * Stored media of ours whose object key could not be recovered, so no signed
 * URL could be built and the client was told the medium is unavailable.
 * `scripts/backfillMediaKeys.ts` reports and repairs such rows.
 */
export const mediaUrlUnresolvable = new client.Counter({
  name: "motionmeet_media_url_unresolvable_total",
  help: "Media that could not be delivered because its object key is unknown, by purpose.",
  labelNames: ["purpose"] as const,
  registers: [registry],
});

/**
 * Media metadata attempts by the media worker: `ok`, `permanent_failure` (the
 * file cannot be read; recorded as done with no metadata) or
 * `transient_failure` (storage/network/ffprobe trouble; the event retries).
 */
export const mediaMetadataResults = new client.Counter({
  name: "motionmeet_media_metadata_total",
  help: "Media metadata probes, by kind (image, video) and result.",
  labelNames: ["kind", "result"] as const,
  registers: [registry],
});

/**
 * The request pool, sampled at scrape time. `waiting` above zero for minutes
 * means requests queue for a connection - the first sign the pool (or the
 * connection budget in DEPLOYMENT.md) is too small, before timeouts appear.
 */
interface PoolCounts { totalCount: number; idleCount: number; waitingCount: number }
let observedPool: PoolCounts | null = null;
export const observeDatabasePool = (pool: PoolCounts): void => { observedPool = pool; };
export const databasePoolConnections = new client.Gauge({
  name: "motionmeet_db_pool_connections",
  help: "Request-pool connections by state (total, idle, waiting requests).",
  labelNames: ["state"] as const,
  registers: [registry],
  collect() {
    if (!observedPool) return;
    this.set({ state: "total" }, observedPool.totalCount);
    this.set({ state: "idle" }, observedPool.idleCount);
    this.set({ state: "waiting" }, observedPool.waitingCount);
  },
});

/** Account exports by outcome (`completed`, `failed`, `aborted` by the client), with their duration. */
export const accountExports = new client.Counter({
  name: "motionmeet_account_exports_total",
  help: "Account exports by outcome.",
  labelNames: ["outcome"] as const,
  registers: [registry],
});
export const accountExportDuration = new client.Histogram({
  name: "motionmeet_account_export_seconds",
  help: "Duration of account exports that completed.",
  buckets: [0.1, 0.5, 1, 5, 15, 60, 300, 900],
  registers: [registry],
});

/**
 * The password worker pool (utils/passwordHashing.ts): checks waiting for a
 * worker, and checks refused because that queue was full. A queue that stays
 * long is a login wave or a credential-stuffing run; refusals are users seeing
 * 503 at sign-in.
 */
let passwordQueueDepth = (): number => 0;
export const observePasswordQueue = (depth: () => number): void => { passwordQueueDepth = depth; };
export const passwordHashQueue = new client.Gauge({
  name: "motionmeet_password_hash_queue",
  help: "Password hashes and checks waiting for a worker thread.",
  registers: [registry],
  collect() { this.set(passwordQueueDepth()); },
});
export const passwordHashRejected = new client.Counter({
  name: "motionmeet_password_hash_rejected_total",
  help: "Password hashes and checks refused because the worker queue was full.",
  registers: [registry],
});

/** Sockets open on this process, sampled at scrape time. */
let openSockets = (): number => 0;
export const observeOpenSockets = (count: () => number): void => { openSockets = count; };
export const socketConnections = new client.Gauge({
  name: "motionmeet_socket_connections",
  help: "Socket.IO connections open on this process.",
  registers: [registry],
  collect() { this.set(openSockets()); },
});

/** `2xx`-style class, so the status label has five values instead of sixty. */
export const statusClass = (status: number): string => `${Math.floor(status / 100)}xx`;
