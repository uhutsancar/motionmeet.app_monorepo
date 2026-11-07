# Test matrix

Status of the plan's scenario ids. PASS means an automated test ran and passed
on 2026-11-06 (unit: 89, integration: 21 against PostgreSQL 18, RabbitMQ 4.2
and Redis 8 in `docker-compose.test.yml`; e2e authorization sweep: 10). NOT_RUN and BLOCKED are stated as such.

| Id | Scenario | Status | Where |
|---|---|---|---|
| P0-PUBLISH-001 | Caption-less presigned photo post | PASS (type resolution, unit) · PASS end to end with real S3 for a photo and a video (manual, rehearsal stack) | `tests/postMedia.test.ts` |
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

## 2026-11 audit (`audit/2026-11-implementation`)

Final run on 2026-11-07: shared 36/36, backend unit 113/113, backend
integration 87/87 (PostgreSQL 18, Redis 8, RabbitMQ 4.2). Work
package status: `docs/architecture/AUDIT_2026_11_STATUS.md`.

| Id | Scenario | Status | Where |
|---|---|---|---|
| R1–R7 | Audit reproductions (deleted/new post on cached profile, nearby opt-outs, field TTL, export, pool self-deadlock, locked-profile fields, deleted account in nearby) | PASS, no `todo` left | `integration/auditRegressions.test.ts`, `poolSelfDeadlock.test.ts` |
| WP-01 | Field TTL, write racing an invalidation never served, single-flight across invalidation, v1/unwrapped entries ignored, maxFields, `CACHE_READS_ENABLED` | PASS (real Redis) | `integration/cacheCore.test.ts`, `cacheCoreWithoutRedis.test.ts` |
| WP-03 | Opt-outs, account deletion and `hidden` distance apply on cache hits; `lastActiveAt` to the hour; no coordinates in responses | PASS | `auditRegressions.test.ts` |
| WP-04 | Export: empty/full account, nesting, secrets scan, 5 000 messages within 50 MB heap, client abort, mid-stream failure breaks the HTTP connection, early failure is a 500 | PASS | `integration/accountExport.test.ts` |
| WP-05 | Seq in commit order under 40 parallel writers, paging, interleaved deletions, offline insert+delete, legacy delete tombstone, recreated conversation, tombstone floor, read position, read-only sync, stranger, backfill; client sync loop | PASS | `integration/messageSync.test.ts`, `shared/tests/messageSync.test.ts` |
| WP-06 | Signed, window-aligned URLs; lifetimes within `[M, W+M)`; story expiry; no unsigned fallback; variants; hydration of posts, stories, messages, avatars, covers | PASS · S3/ImageKit enforcement: BLOCKED-ENV | `mediaDelivery.test.ts`, `integration/signedMedia.test.ts` |
| WP-08 | Like, comment, follow, request, accept, story like roll back with a failing notification; idempotent comment incl. concurrent pair; throwing socket delivery | PASS | `integration/notificationAtomicity.test.ts` |
| WP-09 | Ten write paths with a one-connection pool | PASS | `integration/poolSelfDeadlock.test.ts` |
| WP-10 | Probe failure classification, retry vs null, no signed URL in logs, missing ffprobe throws | PASS | `mediaProbe.test.ts` |
| WP-11 | Logout, password reset, account deletion refuse the old access token at once; sensitive routes check PostgreSQL | PASS (real Redis) | `integration/sessions.test.ts` |
| WP-12 | Remove follower: posts, stories, cached feed, messaging, counters, idempotent, pending request | PASS | `integration/removeFollower.test.ts` |
| WP-13 | Retention of sessions, reset tokens, read notifications, stale coordinates | PASS | `integration/retention.test.ts` |
| WP-15 | Routine save in two inserts | PASS | `integration/routineInsert.test.ts` |
| WP-16 | Comment previews equal the window-function result | PASS | `integration/commentPreview.test.ts` |
| WP-17 | `socket.data` carries identity only | PASS (unit) · two replicas with Redis adapter: BLOCKED-ENV | `socketIdentity.test.ts` |
| e2e | Authorization sweep (+ locked-profile fields, export ownership, remove follower) | Updated · NOT_RUN (needs a stack built from this branch) | `tests/e2e/authorization.e2e.test.ts` |

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

## Authorization sweep (black-box)

`packages/backend/tests/e2e/authorization.e2e.test.ts`, run with
`E2E_BASE_URL=http://localhost:8088 pnpm --filter @motionmeet/backend test:e2e`
against the local production rehearsal stack — **10/10 PASS** (2026-11-06).
A private-account owner, an approved follower and a stranger; for every
resource with an id (posts at each visibility, story, workout share card,
routine, measurement, custom exercise, message) the stranger's read, act and
delete attempts are refused while the follower's and owner's allowed reads
succeed. Also covered: share link without login, profile of a private
account, mass assignment of role/counters/author, admin routes, requests
without a token.

## Second pass (2026-11-06)

| Id | Scenario | Status | Where |
|---|---|---|---|
| FEED-05 | Home feed: exact allowed set, newest first, cursor walk without repeats or gaps — passes on the old and the new query | PASS | `tests/integration/followingFeed.test.ts` |
| — | Boot integrity contract is a catalogue check (bounded time) | PASS | `tests/integration/databaseContracts.test.ts` |
| — | ffprobe output parsing: first video stream, side-data and legacy rotation, unusable probes | PASS | `tests/mediaProbe.test.ts` |
| E2E video | Real S3 upload → worker ffprobe → `durationSeconds` in the API → deletion | PASS (manual) | rehearsal stack |
| OPS-03 | Backend redeploy with web untouched keeps the API reachable | PASS (manual): 200 within ~3 s | `packages/web/nginx.conf` |
| P2-PERF-001 | Same k6 scenario before/after on production-shaped data | PASS: 0 % errors, following p95 212 ms | `docs/quality/PERFORMANCE_BASELINE.md` |
