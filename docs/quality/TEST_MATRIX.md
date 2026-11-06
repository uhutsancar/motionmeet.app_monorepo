# Test matrix

Status of the plan's scenario ids. PASS means an automated test ran and passed
on 2026-11-06 (unit: 86, integration: 16 against PostgreSQL 18 and RabbitMQ
4.2 in `docker-compose.test.yml`). NOT_RUN and BLOCKED are stated as such.

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
| FEED-01/02 | Access withdrawn → cached pages retired | Code review · Redis-backed test: NOT_RUN (integration suite has no Redis) | `services/feedCache.ts` |
| P1-DEPLOY-001 | Worker SIGTERM drains in-flight work | Implemented · BLOCKED on Windows (no POSIX signals to child processes); to run in a Linux container | `runtime/worker.ts` |
| P1-DEPLOY-002 | Scheduled task runs in one process at a time | PASS | `outbox.test.ts` |
| — | Environment: broker transport/role validation | PASS | `tests/environment.test.ts` |
| — | W3C trace continuation, request-id sanitising | PASS | `tests/observabilityContext.test.ts` |
| OPS-02 | Production image boots non-root/read-only | Compose config validated · image build: NOT_RUN | `docker-compose.prod.yml` |
| SEC-03 | Rate limit across replicas | Existing Redis store; with Redis down multi-replica instances go not-ready (`READINESS_REQUIRE_REDIS`) · test: NOT_RUN | `server.ts` |

## Process smoke test (manual, 2026-11-06)

Worker (`OUTBOX_TRANSPORT=rabbitmq`) and scheduler started from their entry
points against the test database and broker: both `/health/ready` 200, three
consumers started, a profile rename went from commit to projected posts in
**644 ms**, metrics showed `published 1` / `applied 1` / backlog 0.

## How to run

```sh
docker compose -f docker-compose.test.yml up -d --wait postgres-test rabbitmq-test
export NODE_ENV=test DATABASE_URL=postgresql://postgres:motionmeet-test@127.0.0.1:5433/motionmeet_test \
  JWT_SECRET=ci-test-secret-that-is-at-least-32-bytes MEDIA_UPLOADS_ENABLED=false EMAIL_ENABLED=false \
  RUN_SCHEDULED_JOBS=false RABBITMQ_URL=amqp://motionmeet:motionmeet-test@127.0.0.1:5673
pnpm --filter @motionmeet/backend migrate:postgres
pnpm --filter @motionmeet/backend test
pnpm --filter @motionmeet/backend test:integration
docker compose -f docker-compose.test.yml down
```
