# Test matrix

Status of the plan's scenario ids. PASS means an automated test ran and passed
on 2026-11-06 (unit: 86, integration: 19 against PostgreSQL 18, RabbitMQ 4.2
and Redis 8 in `docker-compose.test.yml`). NOT_RUN and BLOCKED are stated as such.

| Id | Scenario | Status | Where |
|---|---|---|---|
| P0-PUBLISH-001 | Caption-less presigned photo post | PASS (type resolution, unit) · controller path with real S3: NOT_RUN | `tests/postMedia.test.ts` |
| P0-PUBLISH-002 | Duplicate create with one idempotency key → one post | PASS (existing) | `tests/integration/databaseConcurrency.test.ts` |
| P0-PUBLISH-003 | Per-file MIME and size on `post_media` | PASS | `tests/integration/outbox.test.ts` |
| P0-MOBILE-004 | No full Blob; native cancel | Code review + typecheck/lint · device: NOT_RUN | `mobile/src/api/mediaUpload.ts` |
| P1-QUEUE-001 | DB commit with broker unavailable → row waits → consumed once | PASS | `rabbitmq.test.ts` EVT-01, `outbox.test.ts` |
| P1-QUEUE-002 | Re-publish after confirm → one effect | PASS | `rabbitmq.test.ts` EVT-02 |
| P1-QUEUE-003 | Concurrent duplicate deliveries → one effect; failed apply leaves no record | PASS | `outbox.test.ts` |
| P1-QUEUE-004 | Poison message → `.dead`, queue keeps flowing | PASS | `rabbitmq.test.ts` EVT-04, `domainEvents.test.ts` |
| P1-QUEUE-005 | Two claimers never take the same row | By construction (`FOR UPDATE SKIP LOCKED`, claim token) · dedicated race test: NOT_RUN | `services/outboxService.ts` |
| P1-QUEUE-006 | Unknown version / type handling | PASS (rejected to dead; unknown outbox type retried then dead, redrive) | `domainEvents.test.ts`, `outbox.test.ts` |
| — | Transient failure → retry tier → applied | PASS (real 10 s TTL round trip) | `rabbitmq.test.ts` |
| P1-MEDIA-002 | Upload key of another user cannot be attached | Existing check (owner in reservation query) · test with S3: NOT_RUN | `mediaUploadService.ts` |
| MED-02 | Dimensions from the file, EXIF orientation, garbage → null | PASS | `tests/mediaProbe.test.ts` |
| P1-SOCKET-003 | Revoked/expired/foreign session refused | PASS (session check) · live socket disconnect: NOT_RUN | `tests/integration/sessions.test.ts` |
| RT-04 | Reconnect fetches missed messages | Code + typecheck · device: NOT_RUN | mobile `ChatBox.tsx`, web `Messages.tsx` |
| FEED-01 | Account goes private → cached Keşfet pages retired | PASS (real Redis) | `tests/integration/feedPrivacy.test.ts` |
| FEED-02 | Removed connection → followers-only posts leave the cached feed | PASS (real Redis) | `tests/integration/feedPrivacy.test.ts` |
| — | Deleted post leaves every cached feed | PASS (real Redis) | `tests/integration/feedPrivacy.test.ts` |
| P1-DEPLOY-001 | Worker SIGTERM drains in-flight work | PASS in the production image (`docker compose stop worker`: shutdown_started → shutdown_completed, exit 0) | `runtime/worker.ts` |
| EVT-01 (prod topology) | Worker container stopped → API write succeeds, event waits `pending` → worker started → `published`, projection applied | PASS (manual, local rehearsal stack) | `docker-compose.local.yml` |
| E2E media | Presign → direct PUT to the real S3 bucket → caption-less photo post → per-file MIME/size → worker reads dimensions from S3 → delete → object removed | PASS (manual, 2026-11-06) | `docker-compose.local.yml` |
| P1-DEPLOY-002 | Scheduled task runs in one process at a time | PASS | `outbox.test.ts` |
| — | Environment: broker transport/role validation | PASS | `tests/environment.test.ts` |
| — | W3C trace continuation, request-id sanitising | PASS | `tests/observabilityContext.test.ts` |
| OPS-02 | Production image boots non-root/read-only | PASS: images built with `--pull`, Node 24.22.1 passes the security gate, user `node`, entry points present, web image has no Node; full stack healthy with read-only root filesystems | `docker-compose.prod.yml`, `docker-compose.local.yml` |
| SEC-03 | Rate limit across replicas | Existing Redis store; with Redis down multi-replica instances go not-ready (`READINESS_REQUIRE_REDIS`) · test: NOT_RUN | `server.ts` |

## Process smoke test (manual, 2026-11-06)

Worker (`OUTBOX_TRANSPORT=rabbitmq`) and scheduler started from their entry
points against the test database and broker: both `/health/ready` 200, three
consumers started, a profile rename went from commit to projected posts in
**644 ms**, metrics showed `published 1` / `applied 1` / backlog 0.

## How to run

```sh
docker compose -f docker-compose.test.yml up -d --wait postgres-test rabbitmq-test redis-test
export NODE_ENV=test DATABASE_URL=postgresql://postgres:motionmeet-test@127.0.0.1:5433/motionmeet_test \
  JWT_SECRET=ci-test-secret-that-is-at-least-32-bytes MEDIA_UPLOADS_ENABLED=false EMAIL_ENABLED=false \
  RUN_SCHEDULED_JOBS=false RABBITMQ_URL=amqp://motionmeet:motionmeet-test@127.0.0.1:5673 \
  REDIS_URL=redis://127.0.0.1:6381
pnpm --filter @motionmeet/backend migrate:postgres
pnpm --filter @motionmeet/backend test
pnpm --filter @motionmeet/backend test:integration
docker compose -f docker-compose.test.yml down
```
