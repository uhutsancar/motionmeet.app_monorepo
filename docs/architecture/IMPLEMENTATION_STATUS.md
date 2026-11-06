# Architecture implementation status

Plan: *MotionMeet uçtan uca mimari yeniden değerlendirme ve uygulama planı*
(5 November 2026). States: DONE (implemented and tested), PARTIAL, NOT_STARTED,
BLOCKED. "Tested" means an automated test ran and passed, unless it says
otherwise. Details of each finding: [BASELINE_AUDIT.md](BASELINE_AUDIT.md);
scenario results: [../quality/TEST_MATRIX.md](../quality/TEST_MATRIX.md).

## Work context

- Start: `0774d92` (`main`) + uncommitted work snapshotted as `4e45dbc`.
- Branch: `arch/master-plan`.
- Commits: `22e1c24` P0 fixes · `387b101` outbox/RabbitMQ/processes/metrics ·
  `edd4ef2` socket sessions · `dd87c53` media worker · `f7ba3cf` message
  catch-up · this documentation commit.
- Verification at the end: backend typecheck, lint, 86 unit tests, 16
  integration tests (PostgreSQL 18 + RabbitMQ 4.2), migration run twice
  (second a no-op); mobile and web typecheck + lint; worker/scheduler process
  smoke test; prod/dev compose `config` validation.
- Second pass (same day): dependency security upgrade, production images built
  and run as a full local stack (`docker-compose.local.yml`) with an
  end-to-end check through nginx (real S3 upload, worker, RabbitMQ), worker
  outage and SIGTERM drain, k6 feed load rehearsal, mobile export for
  Android/iOS/web, web production build with its artifact and performance
  checks.
- Not verified: Android/iOS device runs and a release APK build (native
  modules changed with RN 0.88.1 — a new APK is required).

## Work packages

| Id | Subject | State | Notes |
|---|---|---|---|
| MM-P0-01 | End-to-end measurement | PARTIAL | Server: W3C trace + sanitised request id in every log line, outbox rows and AMQP headers; per-route latency histogram. Client timings and an OTel exporter: NOT_STARTED |
| MM-P0-02 | Post creation bugs | DONE | Presigned-only posts, duplicate keys, post type from files, retry keeps keys |
| MM-P0-03 | Real media metadata | DONE for new uploads | Per-file MIME + size; image width/height and video width/height/duration by the media worker (`durationSeconds` in the API). Backfill of rows created before: NOT_STARTED |
| MM-P0-04 | Mobile upload memory/cancel/timeout | DONE in code | 32-byte sniff, native progress, real cancel, stall + size-scaled deadline. Device measurement NOT_RUN; multipart/resumable not needed without data |
| MM-P0-05 | Privacy regression | DONE | Two cache leaks fixed and covered by Redis-backed tests (FEED-01/02), story expiry enforced at read, workout masquerade closed, authorisation sweep passes (see MM-P1-21) |
| MM-P1-01/02/03 | Outbox, RabbitMQ, idempotent consumers | DONE | Migration 014, confirms + mandatory, retry tiers, `.dead`, `processed_events`, redrive script |
| MM-P1-04 | Scheduler separation | DONE | Advisory-locked tasks, graceful stop; SIGTERM drain verified in the production image |
| MM-P1-05 | Queue observability | PARTIAL | Metrics, alert suggestions, runbooks; Grafana dashboard as code (`infra/grafana/motionmeet-overview.json`, PostgreSQL datasource) imported into the existing Grafana. Prometheus scraping of the process metrics: not set up |
| MM-P1-06 | `media_assets` / variants | NOT_STARTED (by decision) | ADR 003: verify synchronously, enrich asynchronously until video volume justifies the asset model |
| MM-P1-07 | Upload/finalize/publish contract | PARTIAL | Contract unchanged and backward compatible; `media.uploaded` event added |
| MM-P1-08 | Image processing | PARTIAL | Dimensions + EXIF orientation. Variants: ImageKit already serves them |
| MM-P1-09 | Video pipeline | PARTIAL | Metadata done: ffprobe in a separate `media-runtime` image for the worker only (API image stays without FFmpeg), reading the object over a 5-minute presigned URL with https-only, bounded probe size and a timeout; verified end to end with real S3. Poster frames, faststart normalisation and HLS: NOT_STARTED (ADR 003) |
| MM-P1-10 | Publish UX | PARTIAL | Mobile and web story/post composers: percent, cancel on close/unmount, cancelled uploads not reported as errors. A server-side `processing` state is not part of this design (ADR 003) |
| MM-P1-11 | Share card | PARTIAL | SSRF bounding was already in place; render cost NOT_MEASURED |
| MM-P1-12 | Feed | DONE | Privacy invalidation (ADR 004); measured on 300 000 posts: home feed rewritten audience-first with a two-step read and covering index (migration 015) — DB 4–8 s → 1.3 ms warm, API p95 under load 3.64 s → 212 ms. Equivalence pinned by `followingFeed.test.ts` (passes on old and new query) |
| MM-P1-13 | Likes/comments | No change needed | `UPDATE … RETURNING` counters kept; existing concurrency test passes |
| MM-P2-14 | Social graph policy matrix | NOT_STARTED | |
| MM-P1-15 | Message durability | PARTIAL | Reconnect catch-up (mobile/web); sockets bound to sessions. `delivered` status: NOT_STARTED |
| MM-P1-16 | Socket.IO scaling | PARTIAL | `READINESS_REQUIRE_REDIS`; presence cost NOT_MEASURED |
| MM-P2-17 | Notifications/push/email | NOT_STARTED | Activity rows already durable; there is no device push (FCM/APNs) to make durable |
| MM-P1-18 | Query planning | PARTIAL | Feed queries planned and fixed on synthetic data (`scripts/load/seed-synthetic.sql`, `explain-feeds.sql`). Boot-time integrity check made O(1) (was 15 s on the same data and blocked startup). Other hot paths and `pg_stat_statements` in production: NOT_STARTED |
| MM-P1-19 | Migration discipline | DONE for 014 | Expand-only, documented down path, idempotent re-run |
| MM-P2-20 | Replicas/sharding | Not needed | Single PostgreSQL kept |
| MM-P1-21 | Auth/session/API security | DONE for this scope | Socket session binding; black-box BOLA/IDOR sweep `tests/e2e/authorization.e2e.test.ts` (10 scenarios, every resource type with an id, positive controls, mass assignment, admin, unauthenticated) passes against the production images. Finding: the server-rendered share page with post-specific Open Graph tags is not reachable behind the web nginx (`/post/:id` serves the SPA shell, which reads `/api/post/:id/public`); private data does not leak, but link previews stay generic — routing `/post/` to the backend is a product decision |
| MM-P1-22 | Object storage security | PARTIAL | Size floor, duplicate refusal. Private CDN for private media: NOT_STARTED |
| MM-P1-23/24 | Privacy lifecycle, moderation | NOT_STARTED | Account deletion now also disconnects sockets and retires feed caches |
| MM-P2-25/26 | Web/mobile performance | NOT_STARTED | Device and browser profiling needed |
| MM-P2-27 | Ads, no payments | Unchanged | No payment, subscription or paywall code added; retired billing endpoints untouched |
| MM-P1-28 | Local topology | DONE | `--profile queue` (RabbitMQ, UI on loopback), `--profile workers` |
| MM-P1-29 | Production compose | DONE | migrate → backend + worker + scheduler; images built and run healthy locally; RabbitMQ health check no longer races the Erlang cookie |
| MM-P2-30 | AWS alternative | NOT_STARTED (by design) | Nothing provisioned |
| MM-P1-31 | CI | PARTIAL | Integration job runs RabbitMQ. Contract/architecture-boundary checks: NOT_STARTED |
| MM-P1-34 | Load/soak tests | PARTIAL | k6 on production-shaped data (20k members, 300k posts, 780k follows, 1M likes): 0 % errors, following p95 212 ms, Keşfet p95 40 ms. Soak (hours) and write-heavy scenarios: NOT_STARTED |
| MM-P1-37 | Chaos | PARTIAL | Broker unavailable at publish time (EVT-01), poison message, transient failure covered |
| MM-P1-38 | RabbitMQ cutover | Documented | DEPLOYMENT.md; default stays `direct` |
| MM-P1-40 | Disaster recovery | NOT_STARTED | Restore drill outline in RUNBOOKS.md |

## Changed contracts

- **Database:** migration `014_outbox_reliability` (outbox enums → text +
  CHECK; `event_id`, `schema_version`, `correlation_id`, `published_at`;
  statuses `published`, `dead`; table `processed_events`).
- **API:** `PostMedia.width/height` (optional, additive). Post type is now
  derived from the attachments; a client sending a different type gets the
  derived one back.
- **Events:** `user.profile.updated` v1, `connection.requested` v1,
  `media.uploaded` v1 — [EVENT_CATALOG.md](EVENT_CATALOG.md).
- **Environment:** `OUTBOX_TRANSPORT`, `RABBITMQ_URL`,
  `ALLOW_INSECURE_RABBITMQ_TLS`, `RABBITMQ_QUEUE_TYPE`, `RABBITMQ_PREFETCH`,
  `OUTBOX_POLL_INTERVAL_MS`, `METRICS_PORT`, `READINESS_REQUIRE_REDIS`,
  `MOTIONMEET_PROCESS_ROLE`.
- **Deployment:** production compose now has `migrate`, `worker`,
  `scheduler`; the API runs with `RUN_MIGRATIONS=false` and
  `RUN_SCHEDULED_JOBS=false`.
- **Dependencies:** `amqplib` 2.2.1 (no dependencies), `prom-client` 15.1.3.

## Dependency security pass (2026-11-06)

The dependency gate failed on four high advisories, all transitive. Each was
removed at its source rather than forced with a major-version override:

| Advisory | Was | Fix applied | Why this way |
|---|---|---|---|
| `zod` GHSA-mrhx-c7xc-m3w5 | 3.25.76 via `@expo/cli` 58.1.15 | Expo SDK 58 patch 58.0.19 → **58.0.23** (`@expo/cli` 58.1.19 no longer depends on zod) | zod has no fixed 3.x; forcing 4.x under a CLI written for 3.x would break it |
| `decode-uri-component` GHSA-qr28-fpjm-wq7f | 0.2.2 via `query-string` 7 via `@react-navigation/core` 7.21 | react-navigation **core 7.24 / native 7.5.1 / native-stack 7.21 / material-top-tabs 7.8.1 / elements 2.9.45** (no `query-string` at all) | the only fixed release is ESM-only and breaks `query-string` 7 (CommonJS) |
| `node-forge` (5 advisories) | 1.4.0 | override to **1.4.3** | patch line, `@expo/cli` asks for ^1.4.0 |
| `follow-redirects` GHSA-mrwp-f3q8-3g9p | 1.16.1 via axios | override to **1.16.2** | patch line, axios asks for ^1.16.0 |

The Expo upgrade aligns every native module with SDK 58.0.23's own
`bundledNativeModules.json`: React Native **0.88.1**, safe-area-context
**5.11.1**, screens **4.30.1**, and the matching `expo-*` patches. Metro stays
on the single pinned 0.87.1 that Expo 58 uses. `expo install --check` (with
dependency validation forced on): "Dependencies are up to date". The audit gate
passes with **zero** accepted exceptions (the `image-size` and `node-forge`
entries were removed as no longer needed). Two moderate advisories below the
gate remain (`glob` 13, `minimatch` 10 — build tooling, fixes are majors).

Bundle effect, measured from the export's source map: Android 4.74 MB and iOS
4.74 MB stay under their 5 MB budgets; the mobile *web* bundle grew to
2.66 MB, mostly `@react-navigation/core` 7.24 (94 KB, now carrying its own URL
parser). Its budget was raised from 2.6 MB to 2.7 MB rather than giving up the
security fix. The largest avoidable item is `@expo/vector-icons` (225 KB of
glyph maps) — the place to start if the budget should go back down.

Native code changed (RN patch, screens, safe-area): a **new APK build** is
needed for the QA device; Expo Go on SDK 58 is the matching runtime for the
JavaScript side.

Base images checked the same day: `node:24.22.1-alpine` digest unchanged
(already current), PostgreSQL 18.6, Redis 8.10.3, RabbitMQ 4.2.9. Node.js has
announced a HIGH security release for 22/24/26 on or after 11 November 2026 —
not yet published; raise the pins when it ships.

## Found by running the production images on production-shaped data

- **API could not start on a large database.** The boot integrity check
  counted rows in follows, connections and messages; at 780 000 follows it hit
  the 15-second statement timeout and the API crash-looped. Now it checks the
  validated CHECK constraints in the catalogue (0.4 s, size-independent).
- **Every backend redeploy broke the web proxy.** nginx resolved `backend`
  once at startup; a recreated backend container got a new address and the
  web container answered 502 until it was restarted too. It now re-resolves
  through Docker's DNS (`resolver 127.0.0.11 valid=10s`); verified by
  recreating only the backend: 200 again within ~3 s.
- **Duplicate init.** Compose `init: true` in front of the image's tini
  produced a warning and a second PID-1 shim; removed.
- **The API image picked up FFmpeg** when the Dockerfile gained its media
  stage (an untargeted build takes the last stage). Every backend service now
  builds `target: runtime`; CI asserts the API image has no ffprobe.
- **Share links' server-rendered preview page is unreachable behind nginx**
  (`/post/:id` serves the SPA shell). No data leaks; link previews are
  generic. Routing `/post/` to the backend is a product decision, left open.

## Open risks

- Node.js security release pending (see above).
- `.env.production.example` carried a password-like value in its example
  `DATABASE_URL` from commit `13cd273` (public history). Replaced with a
  placeholder; rotate it if it was ever a real credential.
- Graceful SIGTERM drain is implemented but not exercised (Windows host).
- Mobile upload and chat catch-up changes are not yet verified on a device.
- Feed audience epoch makes privacy-narrowing writes cost a global cache miss;
  fine at current volume, watch it (ADR 004).

## Next work package

(Updated after the second pass.) Device verification of the mobile changes
on a new QA APK (native modules changed with RN 0.88.1), then the open
product decision on share-link previews, then a soak run.

Previous note:

**Device verification of the mobile changes**, then **web composer progress
wiring**. Prerequisites: backend running, Expo Go on the iPhone (SDK 58), a
release APK. Files: `mobile/src/api/mediaUpload.ts`,
`mobile/src/components/{StoryComposer,CreatePostModal}.tsx`,
`mobile/src/pages/ChatBox.tsx`, `web/src/components/StoryComposer.tsx`,
`web/src/pages/CreatePost.tsx`. Checks: 5 MB photo and 50 MB video on
throttled 3G; close the composer mid-upload (traffic must stop); background
the app, send it a message, return (message must appear).
