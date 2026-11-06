# Observability

## Correlation

- `middlewares/requestContext.ts` continues a valid W3C `traceparent` from the
  caller or starts a trace, and keeps an incoming `X-Request-Id` only if it
  matches `[A-Za-z0-9._:-]{8,128}` (anything else is replaced, so a header
  cannot inject into logs).
- The ids live in AsyncLocalStorage (`observability/context.ts`); every
  `logger` line written during the request carries `requestId` and `traceId`.
- Outbox rows store the trace id in `correlation_id`; the publisher sends it
  as `traceparent`; consumers and the direct dispatcher run under it. One
  search by trace id finds the API line, the publish and the worker line.
- Not yet: an OpenTelemetry SDK exporting spans. The ids are W3C-compatible
  so one can be added without changing any producer.

## Metrics

Served on the private ops port (`METRICS_PORT`, default compose value 9464),
never on the public port. Every series has a `role` label (`api`, `worker`,
`scheduler`).

| Metric | Type | Labels | Use |
|---|---|---|---|
| `motionmeet_http_request_duration_seconds` | histogram | method, route (template), status_class | p50/p95/p99 per endpoint, error ratio |
| `motionmeet_outbox_events_total` | counter | transport, event_type, outcome (published, retry, dead) | delivery rate and failures |
| `motionmeet_outbox_publish_batch_seconds` | histogram | transport | publish + confirm latency |
| `motionmeet_outbox_pending` | gauge (worker) | — | backlog |
| `motionmeet_outbox_dead` | gauge (worker) | — | parked events |
| `motionmeet_outbox_oldest_pending_seconds` | gauge (worker) | — | delivery lag |
| `motionmeet_events_consumed_total` | counter | consumer, outcome (applied, duplicate, retried, dead) | consumer health, redelivery rate |
| `motionmeet_event_handle_seconds` | histogram | consumer | consumer cost |
| `motionmeet_scheduled_task_runs_total` | counter | task, outcome (ran, skipped_locked, failed) | housekeeping health |
| `motionmeet_scheduled_task_seconds` | histogram | task | sweep duration |
| `motionmeet_process_*`, `motionmeet_nodejs_*` | prom-client defaults | — | event-loop lag, heap, GC, RSS |

Cardinality rule: labels are route templates, event types, consumer and task
names and outcome words. Never a user id, post id, raw path, object key or URL.

Broker-side figures (queue depth, unacked, consumers) come from RabbitMQ's own
Prometheus plugin (`rabbitmq_prometheus`, port 15692) — enable it on the broker.

## Suggested alerts (initial thresholds, to be tuned with real traffic)

| Alert | Condition | Why |
|---|---|---|
| Outbox lag | `motionmeet_outbox_oldest_pending_seconds > 300` for 5 min | broker down, worker down, or a stuck consumer |
| Dead events | `increase(motionmeet_outbox_dead[15m]) > 0` or any message in a `*.dead` queue | needs an operator (RUNBOOKS.md) |
| Consumer retries | `rate(motionmeet_events_consumed_total{outcome="retried"}[10m])` above its usual band | dependency degrading |
| Scheduler failing | `increase(motionmeet_scheduled_task_runs_total{outcome="failed"}[1h]) > 0` | sweeps not running |
| API errors | 5xx ratio > 1 % for 10 min | user impact |
| Event loop | `motionmeet_nodejs_eventloop_lag_p99_seconds > 0.2` for 10 min | CPU work on the request path |

## Not yet

- Grafana: `infra/grafana/motionmeet-overview.json` (PostgreSQL datasource,
  import into an existing Grafana; see `infra/grafana/README.md`). A
  Prometheus datasource for the process metrics above is not set up.
- Client-side timing (tap → upload done → visible) and crash reporting —
  NOT_STARTED; needs a chosen vendor and consent handling.
- Slow-query capture (`pg_stat_statements`) — a database setting, documented in
  DEPLOYMENT.md, not enabled by this repository.
