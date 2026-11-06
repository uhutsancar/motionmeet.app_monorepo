# Deployment

`docker-compose.prod.yml` runs one backend image as four services. PostgreSQL,
Redis and (optionally) RabbitMQ are external managed services named in
`.env.production`.

| Service | Command | Key settings |
|---|---|---|
| `migrate` | `node dist/scripts/migrate.js` | runs once per `up`; the others wait for it to succeed |
| `backend` | `node dist/server.js` | `RUN_MIGRATIONS=false`, `RUN_SCHEDULED_JOBS=false`, `METRICS_PORT=9464` |
| `worker` | `node dist/entrypoints/worker.js` | image target `media-runtime` (FFmpeg for video metadata; the API image has none), pool 10, 1 CPU / 512 MB, 30 s stop grace |
| `scheduler` | `node dist/entrypoints/scheduler.js` | pool 5, 0.5 CPU / 256 MB, 30 s stop grace |
| `web` | Nginx static build | unchanged |

All backend services: read-only root filesystem, `/tmp` tmpfs, all
capabilities dropped, `no-new-privileges`, non-root user, `tini` as PID 1.

## Environment (beyond `.env.production.example`)

| Variable | Default | Notes |
|---|---|---|
| `OUTBOX_TRANSPORT` | `direct` | `rabbitmq` to publish through the broker |
| `RABBITMQ_URL` | — | required for `rabbitmq`; `amqps://user:pass@host:5671/vhost` in production |
| `ALLOW_INSECURE_RABBITMQ_TLS` | `false` | only for a broker on a private network |
| `RABBITMQ_QUEUE_TYPE` | `quorum` | `classic` only for a broker that cannot run quorum queues |
| `RABBITMQ_PREFETCH` | `10` | per consumer channel |
| `OUTBOX_POLL_INTERVAL_MS` | `1000` | idle wait between empty claims |
| `METRICS_PORT` | unset | private ops listener; keep it off the proxy |
| `READINESS_REQUIRE_REDIS` | `false` | set `true` with more than one API replica |
| `MOTIONMEET_PROCESS_ROLE` | `api` | set by the entry points; names DB connections and metrics |

## Connection budget

PostgreSQL connections = API replicas × `DATABASE_POOL_MAX` (30)
+ worker replicas × 10 + scheduler replicas × 5 + 1 (migrate) + headroom for
administration. Check it against the server's `max_connections` before
scaling any of them.

## Release procedure

1. Build and tag the image once (`MOTIONMEET_IMAGE_TAG`); every service uses it.
2. `docker compose -f docker-compose.prod.yml up -d` — `migrate` runs first;
   migrations are expand-only, so the previous release keeps working against
   the new schema during the rollout.
3. Watch: `/health/ready` on each service, `motionmeet_outbox_oldest_pending_seconds`,
   5xx ratio, `motionmeet_events_consumed_total{outcome="dead"}`.
4. Roll back by redeploying the previous tag. The schema stays (expand-only);
   see RUNBOOKS.md for migration `014`'s down path if it is ever needed.

## Switching the outbox to RabbitMQ

1. Provision the broker: dedicated vhost, a user with configure/write/read on
   `^motionmeet\.` only, TLS, quorum queues, `rabbitmq_prometheus` enabled.
   Management UI on a private network only — never publish port 15672.
2. Set `OUTBOX_TRANSPORT=rabbitmq` and `RABBITMQ_URL` for the **worker**. The
   API never publishes; with `RUN_SCHEDULED_JOBS=false` it does not dispatch
   either.
3. Deploy the worker. It declares the topology, then publishes the pending
   backlog. Consumers deduplicate by event id, so rows the old direct
   dispatcher already handled are not applied twice.
4. Rollback: set `OUTBOX_TRANSPORT=direct` and redeploy the worker. Events
   already in queues are still consumed by nobody until switched back — drain
   the queues first (stop the publisher, let consumers empty them) if the
   switch is meant to be permanent.

## Local production rehearsal

`docker-compose.local.yml` runs the same images and process split on one
machine, with PostgreSQL 18, Redis 8 and RabbitMQ 4.2 bundled:

```sh
MOTIONMEET_ENV_FILE=.env.production.example \
  docker compose -f docker-compose.prod.yml -f docker-compose.local.yml up -d --build
# http://localhost:8088  ·  RabbitMQ UI: http://127.0.0.1:15673 (motionmeet / motionmeet-local)
```

Media keys come from `packages/backend/.env` if present (real bucket); every
data-service setting is overridden, so it never touches a natively running
development database. Only port 8088 and the loopback-bound broker UI are
published. Load rehearsal: `scripts/load/feed-read.k6.js` (header of the file
has the command).

## Notes for large databases

- Migration 015 builds `posts_author_timeline_idx` with a plain `CREATE
  INDEX` (the migrator runs in a transaction). On a large `posts` table build
  it by hand first with `CREATE INDEX CONCURRENTLY IF NOT EXISTS` - same
  definition as in the migration - so the migration becomes a no-op.
- The web container's nginx resolves `backend` through Docker's embedded DNS
  (`resolver 127.0.0.11`). Outside Docker, point `resolver` at the platform's
  DNS.

## Database settings this code assumes

- `pg_stat_statements` enabled, for slow-query work.
- Point-in-time recovery with a tested restore.
- `statement_timeout` is set per connection by the API pool (15 s); the
  maintenance pool used by migrations has none.
