# Performance baseline

Honest state: there is no production traffic to measure and no load test was
run in this work. Everything below is either a measured number with its
conditions or NOT_MEASURED. Targets are the plan's starting SLOs, not claims.

## Measured

| What | Value | Conditions |
|---|---|---|
| Outbox commit → consumer effect, RabbitMQ path | 644 ms | One event, local Docker RabbitMQ 4.2 + PostgreSQL 18, worker via `tsx`, poll interval 1 s (most of it is the poll wait) |
| Outbox commit → consumer effect, before | up to 60 s | Once-a-minute cron (by construction) |
| Retry round trip through tier 0 | ≈10.1 s | Integration test; tier TTL 10 s |
| Integration suite | 21–25 s | 16 tests (first pass; 21 tests now), serial, same machine |
| Feed first page, Keşfet (`/api/post/feed?mode=discover`) | p50 4.2 ms · p95 25.5 ms · max 89 ms | k6 (`scripts/load/feed-read.k6.js`), 10 VUs, 30 s, 1156 requests, 0 % errors; local production rehearsal stack through nginx, near-empty database, warm Redis cache |
| Feed first page, following | p50 4.0 ms · p95 21.8 ms · max 39 ms | same run |
| Commit → projection through RabbitMQ, production images | 0.98 s (rename), 1.0 s (image measured from real S3) | `docker-compose.local.yml`, worker in its own container |
| Worker graceful stop (SIGTERM) | 16 ms drain, exit 0 | `docker compose stop worker`, Linux container |

The feed numbers describe the code path and the cache, not capacity: the
database held a handful of rows. Repeat with production-sized synthetic data
before treating them as a baseline.

## Expected effects, not yet measured

| Change | Expected effect | How to measure |
|---|---|---|
| Mobile upload reads 32 bytes instead of the whole file | Peak JS memory no longer grows with file size (a 100 MB video was a 100 MB Blob) | Android Studio profiler / `adb shell dumpsys meminfo`, release build, 5 MB photo and 50–100 MB video, before/after |
| Native cancel and stall timeout | No background transfer after the composer closes; no endless spinner | Throttled network on device, close composer mid-upload, watch traffic |
| Profile projection off the request path | Rename latency unchanged for the user; WAL from `UPDATE posts` moves to the worker | `pg_stat_statements` on the projection update for an author with 10k posts |
| Feed audience epoch | Extra cache misses right after privacy-narrowing writes | Feed p95 and Redis hit rate around epoch bumps |

## Targets to calibrate (plan §15, not measured)

| Path | Initial target |
|---|---|
| Feed first page (API) | p95 < 350 ms |
| Profile read | p95 < 150–250 ms |
| Message persist + ack | p95 < 200 ms |
| Presign | p95 < 200 ms |
| Post create after upload (incl. S3 verification) | p95 < 300 ms |

`motionmeet_http_request_duration_seconds` now provides these per route;
record a week of real traffic before turning any of them into alerts.

## NOT_MEASURED

Soak tests (hours), write-heavy load, Socket.IO connection scaling,
`fetchSockets` presence cost, share-card render CPU, mobile FPS/crash rates,
web vitals. (Read-path load on production-shaped data is measured above.)

## Production-shaped data (2026-11-06, second pass)

`scripts/load/seed-synthetic.sql` on the rehearsal stack: 20 000 members (10 %
private), 779 718 follows on a power-law graph (top account: 15 597
followers), 20 000 connections, 300 014 posts over 90 days, 999 668 likes.
Plans: `scripts/load/explain-feeds.sql`.

| Query / path | Before | After | Change |
|---|---|---|---|
| Home (following) feed, first page, DB time | 3.7–8.1 s — scanned 543 735 index entries and ran the connection sub-query 282 253 times | 1.3 ms warm, 150–230 ms for a never-seen viewer (21 cold heap reads) | audience-first query + covering `posts_author_timeline_idx` (migration 015) |
| Same query issued by the API under load (parameterised) | 10–13 s per cache miss, timeouts | see k6 below | two-step read: ids from the index (index-only, stops at the page size), rows only for the final page |
| Keşfet first page, DB time | 0.5–0.8 ms | unchanged | partial index already served it |
| API boot, `database_contract` phase | 15 s → statement timeout → the API could not start | 0.4 s, boot 0.6 s | catalogue check of validated CHECK constraints instead of counting rows |

Disk note: the rehearsal database lives in Docker Desktop's VM on this
machine; a cold random page read measured about 9 ms, so cold-path numbers
are pessimistic next to a managed database on SSD.

### Load through the API on the same data (k6, `scripts/load/feed-read.k6.js`)

20 VUs for 60 s over 300 distinct seeded members (`TOKENS_FILE`), so most
requests miss the 30-second per-member feed cache, through nginx:

| Run | Following p95 | Keşfet p95 | Errors | Throughput |
|---|---|---|---|---|
| Table-scan query (before) | 3.64 s, max 15.8 s | 306 ms | 1.18 % (statement timeouts) | 28 req/s |
| Audience-first, two-step (after) | **212 ms** (median 4.9 ms) | **40 ms** (median 5.0 ms) | **0 %** of 4 168 | 69 req/s |

### Video metadata (worker, real S3)

2-second test video: presign → direct PUT → post (type derived as `video`)
→ the media worker's ffprobe read the object over a presigned URL and stored
2.000 s and 320×240 within 2.6 s of the post; the API returns
`durationSeconds: 2`. The test object was deleted afterwards.
