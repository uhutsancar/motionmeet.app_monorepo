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

/** `2xx`-style class, so the status label has five values instead of sixty. */
export const statusClass = (status: number): string => `${Math.floor(status / 100)}xx`;
