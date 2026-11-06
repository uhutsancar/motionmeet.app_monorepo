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
- Not verified: Android/iOS device runs, release APK build, production image
  build, web production build, load tests.

## Work packages

| Id | Subject | State | Notes |
|---|---|---|---|
| MM-P0-01 | End-to-end measurement | PARTIAL | Server: W3C trace + sanitised request id in every log line, outbox rows and AMQP headers; per-route latency histogram. Client timings and an OTel exporter: NOT_STARTED |
| MM-P0-02 | Post creation bugs | DONE | Presigned-only posts, duplicate keys, post type from files, retry keeps keys |
| MM-P0-03 | Real media metadata | PARTIAL | Per-file MIME + size (DONE); image width/height by worker (DONE); video duration and backfill of old rows: NOT_STARTED |
| MM-P0-04 | Mobile upload memory/cancel/timeout | DONE in code | 32-byte sniff, native progress, real cancel, stall + size-scaled deadline. Device measurement NOT_RUN; multipart/resumable not needed without data |
| MM-P0-05 | Privacy regression | PARTIAL | Two cache leaks fixed, story expiry enforced at read, workout masquerade closed. Redis-backed cache tests NOT_RUN |
| MM-P1-01/02/03 | Outbox, RabbitMQ, idempotent consumers | DONE | Migration 014, confirms + mandatory, retry tiers, `.dead`, `processed_events`, redrive script |
| MM-P1-04 | Scheduler separation | DONE | Advisory-locked tasks, graceful stop; SIGTERM drain BLOCKED for testing on Windows |
| MM-P1-05 | Queue observability | PARTIAL | Metrics, alert suggestions, runbooks. Dashboards/alert rules as code: NOT_STARTED |
| MM-P1-06 | `media_assets` / variants | NOT_STARTED (by decision) | ADR 003: verify synchronously, enrich asynchronously until video volume justifies the asset model |
| MM-P1-07 | Upload/finalize/publish contract | PARTIAL | Contract unchanged and backward compatible; `media.uploaded` event added |
| MM-P1-08 | Image processing | PARTIAL | Dimensions + EXIF orientation. Variants: ImageKit already serves them |
| MM-P1-09 | Video pipeline | NOT_STARTED | Needs ffprobe/FFmpeg image and usage data |
| MM-P1-10 | Publish UX | PARTIAL | Mobile story/post: percent + cancel on close. Web API supports progress/abort; web composers not wired |
| MM-P1-11 | Share card | PARTIAL | SSRF bounding was already in place; render cost NOT_MEASURED |
| MM-P1-12 | Feed | PARTIAL | Privacy invalidation (ADR 004). Benchmarks/EXPLAIN on synthetic data: NOT_STARTED |
| MM-P1-13 | Likes/comments | No change needed | `UPDATE … RETURNING` counters kept; existing concurrency test passes |
| MM-P2-14 | Social graph policy matrix | NOT_STARTED | |
| MM-P1-15 | Message durability | PARTIAL | Reconnect catch-up (mobile/web); sockets bound to sessions. `delivered` status: NOT_STARTED |
| MM-P1-16 | Socket.IO scaling | PARTIAL | `READINESS_REQUIRE_REDIS`; presence cost NOT_MEASURED |
| MM-P2-17 | Notifications/push/email | NOT_STARTED | Activity rows already durable; there is no device push (FCM/APNs) to make durable |
| MM-P1-18 | Query planning | NOT_STARTED | Needs `pg_stat_statements` and representative data |
| MM-P1-19 | Migration discipline | DONE for 014 | Expand-only, documented down path, idempotent re-run |
| MM-P2-20 | Replicas/sharding | Not needed | Single PostgreSQL kept |
| MM-P1-21 | Auth/session/API security | PARTIAL | Socket session binding. BOLA/IDOR sweep: NOT_STARTED |
| MM-P1-22 | Object storage security | PARTIAL | Size floor, duplicate refusal. Private CDN for private media: NOT_STARTED |
| MM-P1-23/24 | Privacy lifecycle, moderation | NOT_STARTED | Account deletion now also disconnects sockets and retires feed caches |
| MM-P2-25/26 | Web/mobile performance | NOT_STARTED | Device and browser profiling needed |
| MM-P2-27 | Ads, no payments | Unchanged | No payment, subscription or paywall code added; retired billing endpoints untouched |
| MM-P1-28 | Local topology | DONE | `--profile queue` (RabbitMQ, UI on loopback), `--profile workers` |
| MM-P1-29 | Production compose | DONE (config validated) | migrate → backend + worker + scheduler; image build NOT_RUN |
| MM-P2-30 | AWS alternative | NOT_STARTED (by design) | Nothing provisioned |
| MM-P1-31 | CI | PARTIAL | Integration job runs RabbitMQ. Contract/architecture-boundary checks: NOT_STARTED |
| MM-P1-34 | Load/soak tests | NOT_STARTED | |
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

## Open risks

- **Dependency audit fails, independent of this work.** New advisories in the
  Expo toolchain's transitive dependencies: `node-forge` 1.4.0 (fix 1.4.1),
  `follow-redirects` 1.16.1 (fix 1.16.2), `decode-uri-component` 0.2.2 (fix
  0.5.1), `zod` 3.25.76 (fix 4.6.6). The two patch-level ones are low-risk
  overrides; the other two cross a major line and need an Expo compatibility
  check. Not changed here. Stale `image-size` exceptions were removed.
- Graceful SIGTERM drain is implemented but not exercised (Windows host).
- Mobile upload and chat catch-up changes are not yet verified on a device.
- Feed audience epoch makes privacy-narrowing writes cost a global cache miss;
  fine at current volume, watch it (ADR 004).

## Next work package

**Device verification of the mobile changes**, then **web composer progress
wiring**. Prerequisites: backend running, Expo Go on the iPhone (SDK 58), a
release APK. Files: `mobile/src/api/mediaUpload.ts`,
`mobile/src/components/{StoryComposer,CreatePostModal}.tsx`,
`mobile/src/pages/ChatBox.tsx`, `web/src/components/StoryComposer.tsx`,
`web/src/pages/CreatePost.tsx`. Checks: 5 MB photo and 50 MB video on
throttled 3G; close the composer mid-upload (traffic must stop); background
the app, send it a message, return (message must appear).
