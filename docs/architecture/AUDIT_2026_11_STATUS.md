# Audit 2026-11 — implementation status

Single source of truth for the work packages in `MOTIONMEET_UYGULAMA_PLANI_v2.1.md`
(plan reviewed at commit `a8e1b17`). Branch: `audit/2026-11-implementation`.

Status values: `NOT_STARTED`, `IN_PROGRESS`, `DONE`, `BLOCKED`, `BLOCKED-ENV`
(code side done, the remaining acceptance step needs infrastructure — see Ek B).

| ID | Durum | Commit(ler) | Test(ler) | Kalan sınırlama |
| --- | --- | --- | --- | --- |
| WP-00 | DONE | see `git log --grep WP-00` | `tests/integration/auditRegressions.test.ts` (R1–R7 as `todo`) | Baseline: lint 4/4, typecheck 6/6, unit 89/89, integration 21/21 |
| WP-01 | DONE | see `git log --grep WP-01` | `integration/cacheCore.test.ts` (8), `cacheCoreWithoutRedis.test.ts` (3), R4 in `auditRegressions`, `environment.test.ts` | Mixed-version window during the deploy that switches to `v2`: ≤ TTL staleness unless `CACHE_READS_ENABLED=false` is used (DEPLOYMENT.md). Invalidation is skipped in processes that never connect to Redis (worker/scheduler) — today all cache-relevant writes are in the API |
| WP-02 | DONE | see `git log --grep WP-02` | `auditRegressions.test.ts` R1, R2, two-viewer delete (profile + feeds + single post), workout statistics | Like/comment counts on profiles still follow the 60 s TTL by design. No workout delete path exists, so only creation invalidates |
| WP-03 | DONE | see `git log --grep WP-03` | `auditRegressions.test.ts` R3, R7, hidden-distance on cache hit (band + area), `lastActiveAt` to the hour, no coordinate keys in the response | A target's *position* can be ≤ 45 s old in cached candidates (moves bands only). EXPLAIN (20 000 synthetic members, rolled back): the per-request lookup is 50 `user_locations_pkey` + 30 `users_pkey` index scans, ~240 buffers |
| WP-04 | BLOCKED-ENV | see `git log --grep WP-04` | `integration/accountExport.test.ts` (6: empty, full with nesting + secrets scan, 5 000 messages + 2 000 likes heap < 50 MB, client abort leaves no active query, mid-stream failure breaks the connection over real HTTP, early failure is a 500), R5; e2e sweep scenario added | Code done. Device check of the mobile file share (Ek B-11) pending. Mobile uses the already-installed `expo-file-system`/`expo-sharing` — **no new native module, no new APK needed**. e2e sweep updated but not run (needs a stack built from this branch) |
| WP-05 | BLOCKED-ENV | see `git log --grep WP-05` | `integration/messageSync.test.ts` (14: commit order with 40 parallel writers and a reader syncing throughout, paging, interleaved deletions, offline insert+delete, legacy delete tombstone, gone/recreated conversation, cursor ahead, tombstone floor + orphan purge, read position incl. own messages, read-only, stranger, backfill); `shared/tests/messageSync.test.ts` (12); migration 016 down×2/up×2 verified | Code done for backend, web and mobile. Real-device background/foreground and real-browser reconnect flows not automated (Ek B-11). Plan said three requests for 200 messages / limit 100; with the limit+1 lookahead it is two, and a third from the final cursor is asserted empty |
| WP-06 | BLOCKED-ENV | see `git log --grep WP-06` | `mediaDelivery.test.ts` (11, red first), `integration/signedMedia.test.ts` (4: feed/profile post media + variants, avatar, cover, story ≤ expiry, message photo, unresolvable → unavailable), `environment.test.ts`, shared `media.test.ts` (+2) | Code done: signing at read time on every hydration path, variants, placeholders (web + mobile), `backfill:media-keys`, optional purge, docs, example bucket policy. Rollout risk found at the end: builds older than this release add `w-…` to post image URLs, which breaks a signature — ship clients before enabling signed delivery (DEPLOYMENT.md step 0). Remaining: Ek B-1 (S3 prefix policy), B-2 (ImageKit origin + "Restrict unsigned URLs"), B-3 (purge quota/wildcard) — and the rollout order in DEPLOYMENT.md |
| WP-07 | DONE | see `git log --grep WP-07` | `auditRegressions.test.ts` R6b + positive follower/public checks | D-04 default applied. Old store builds: no release tags in the repo; the last 60 mobile commits never read `statistics`/`weight`/`height` of another member without optional chaining, so `null` is safe for them |
| WP-08 | DONE | see `git log --grep WP-08` | `integration/notificationAtomicity.test.ts` (7: like, toggle-like, comment, follow/request/accept, story like each rolled back with their failing notification via a trigger; idempotent comment incl. a concurrent pair; throwing socket delivery does not fail the request); migration 017 down×2/up×2 verified | Delivery stays best effort (socket); clients send `operationId` for comments (web + mobile) and reuse it on retry |
| WP-09 | DONE | see `git log --grep WP-09` | `integration/poolSelfDeadlock.test.ts` (child process, `DATABASE_POOL_MAX=1`, 10 write paths each < 2 s) | Scan of every `withTransaction` block (accountService, authService ×2, exerciseService, measurementService, mediaDeletionService, mediaUploadService, messageService ×3, postInteractionService ×4, postService ×2, relationshipService ×4, routineService ×3, storyService ×2, userService ×4, workoutService, cronJobs ×2, consumers): the only helper reading through the global pool was `storyService.hydrate` (fixed). All other helpers called inside transactions either take the executor (`findHydratedPost`, `hydratePosts`, `findWorkoutById`, `applyWorkoutAnalytics`, `commitReservedUploads`, `queueMediaDeletions`, `enqueueOutboxEvent`, `reserveQuota`, `hydrateMessages`) or are pure |
| WP-10 | DONE | see `git log --grep WP-10` | `mediaProbe.test.ts` (+4: transient/permanent classification, retry vs null, no signed URL in any log line, missing ffprobe throws) | Unknown ffprobe failures are treated as transient (retried, visible in `.dead`) rather than silently completed. Worker readiness reports `videoProbe` and `degraded`. In single-process local mode the API applies media events without ffprobe, so video events retry and dead-letter there by design (logged at start-up). `backfill:media-metadata` not run against real data |
| WP-11 | DONE | see `git log --grep WP-11` | `integration/sessions.test.ts` (+4: logout, password reset and account deletion refuse the old access token at once; sensitive routes refuse a revoked session without the Redis marker) | D-09 default applied. Accepted risk (in SECURITY_THREAT_MODEL.md): with Redis down, non-sensitive routes accept a revoked token for ≤ 15 min. There is no "log out all devices" endpoint to wire |
| WP-12 | DONE | see `git log --grep WP-12` | `integration/removeFollower.test.ts` (3: private account's posts/stories/cached feed/messaging lost, counters; idempotent; pending request dropped); e2e sweep scenario added | D-08 default applied: removal for public and private accounts, no blocking. UI: web and mobile Connections → Followers → Remove (with confirmation) |
| WP-13 | DONE | see `git log --grep WP-13` | `integration/retention.test.ts` (5: tasks scheduled; sessions; reset tokens; read notifications; stale location wipe keeps settings and drops out of nearby) | D-07 default applied (30 days). `lastActiveAt` to the hour was done in WP-03. Retention table in docs/database.md |
| WP-14 | N/A | | | The plan has no WP-14 (numbering skips from 13 to 15). |
| WP-15 | DONE | see `git log --grep WP-15` | `integration/routineInsert.test.ts` (driver-level count: 60 → ≤ 2 `routine_*` inserts for 10 × 5; update path too; content read back unchanged) | — |
| WP-16 | DONE | see `git log --grep WP-16` | `integration/commentPreview.test.ts` (same preview set as the window-function query, incl. timestamp ties; cursor only when more exist) | Measured on the test container (30 posts × 10 000 comments, rolled back): 640.8 ms → 0.92 ms, 4 286 → 150 buffers. The synthetic seed now has the hot-thread scenario and `explain-feeds.sql` both plans; the full synthetic run on production-shaped data was not repeated. Found and fixed on the way: same-instant comments had no deterministic order, so the older-comments cursor could start from the wrong one |
| WP-17 | BLOCKED-ENV | see `git log --grep WP-17` | `socketIdentity.test.ts` (unit: `socket.data` is exactly userId/sessionId/role, no email in what `fetchSockets()` transports; local record released on leave) | Item 1 done. Item 3 (measure `fetchSockets()` with two replicas, 5 000 sockets, one replica paused) needs infrastructure — procedure in RUNBOOKS "Two-replica rehearsal" step 6 (Ek B-8). Item 2 (sorted-set presence) deliberately not implemented: the plan's rule makes it conditional on that measurement. Plan's two-`Server` + Redis adapter test replaced by a unit test: the backend has no `socket.io-client`, and adding a dependency only for this was not justified |
| WP-18 | DONE | see `git log --grep WP-18` | `scripts/check-web-artifact.mjs` now fails unless nginx answers 404 for `/health/ready` (rule red before the change, green after); `nginx -t` in `nginx-unprivileged:stable-alpine` passes; `environment.test.ts` covers the new variables | Web container health check uses `/health/live` (still proxied); backend checks use the ops/API port directly, so nothing else depended on the public readiness route |
| WP-19 | BLOCKED-ENV | see `git log --grep WP-19` | Merged compose (`prod` + `local` + `replicas`) validated with `docker compose config` (nothing started); gates green | Code side done: WebSocket-only transport on server, web and mobile (old builds list websocket first, so they still connect); `docker-compose.replicas.yml` + `--scale backend=2` (DNS round-robin through the existing per-request resolver instead of a static `upstream` block, which would pin addresses); test plan in RUNBOOKS "Two-replica rehearsal". Running it is Ek B-8. Not started on the user's 8088 rehearsal stack on purpose |
| WP-20 | BLOCKED-ENV | see `git log --grep WP-20` | `auditMetrics.test.ts` (every metric the alert rules use is registered; pool gauge reads total/idle/waiting at scrape time); example YAMLs parse | Code side done: pool gauge, export count/duration (cache invalidation, media unresolvable and metadata metrics came with WP-01/06/10), `infra/prometheus/` scrape + 8 alert rules with runbook links, connection budget table in DEPLOYMENT.md, observability.md updated. Prometheus/alerting activation, restore drill, k6 mix and soak (MM-OPS-02…05, MM-PERF-02/05/06/07/08) are Ek B-6, B-7, B-9, B-12 |

## Baseline (WP-00 step 1)

- HEAD at start: `a8e1b17b520ee752a44ef81e846d7bb2429ef18a` — matches the plan; no re-validation of "Mevcut durum" needed.
- Environment: Windows 11, Node 24.22.1, pnpm 11.10.0; test services from `docker-compose.test.yml`
  (PostgreSQL 18, RabbitMQ 4.2, Redis 8).
- `pnpm --filter @motionmeet/shared build`: OK.
- `migrate:postgres` twice: 001–015 applied, second run a no-op.
- Backend unit tests: **89/89 pass** (`tsx --test tests/*.test.ts`, 13 s).
- Backend integration tests: **21/21 pass**, RabbitMQ included (`--test-concurrency=1`, 45 s).
- `pnpm lint`, `pnpm typecheck` (whole workspace): see the WP-00 row.
- `auditRegressions.test.ts` added with R1–R7 as `todo`: all 7 run and fail at the
  assertion that states the bug (not in their setup), confirming the reproductions.

## Decisions applied

- **WP-07 — D-04 varsayılanı uygulandı:** `canViewContent=false` iken `weight`, `height`, `statistics` → `null`.
  `User` (the owner's own record) keeps them non-nullable in the shared types.
- **WP-01 — D-10 varsayılanı uygulandı:** invalidation = first attempt + 3 retries (50/150/400 ms), then
  `cache_invalidation_failed` log + `motionmeet_cache_invalidation_failures_total`; the mutation stays successful.
- **WP-01 — plan dışı karar:** the custom-exercise flag moved from one global hash (`maxFields` 10 000) to one
  owner per member (`exercises:custom-owner:<id>`), so `createExercise` can retire it race-safely instead of writing
  `true` over a possibly racing `false`. More restrictive/safer than the plan's "may stay global".
- **WP-04 — D-05 varsayılanı uygulandı:** `user_locations` (coordinates included) is exported to its owner.
- **WP-04 — plan dışı karar:** `uploadReservations` no longer exports `object_key` either (storage keys are ours, not the
  member's), and `notifications`/`conversations` omit internal ids of other tables beyond what identifies the row.
- **WP-05 — D-06 varsayılanı uygulandı:** "delete for everyone" stays a hard delete; tombstones are kept 30 days
  (`message-tombstone-retention`, daily 04:23).
- **WP-06 — D-01/D-02/D-03 varsayılanları uygulandı:** every medium signed (avatars/covers too, 24 h window);
  windows messages/stories 1 h + 5 min, posts 6 h + 15 min, profiles/covers 24 h + 1 h; purge off by default.
- **WP-06 — plan dışı kararlar:** (1) post images also carry signed `variants` (thumb/feed/detail): clients resized
  images by rewriting the ImageKit `tr` parameter, which would invalidate a signature, so `mediaVariantUrl` now never
  touches a signed URL and the server signs the display widths. (2) An unresolvable avatar/cover is served as `""` (the
  existing "no picture" value every client renders as the default avatar) instead of `null`, so `PublicUser` stays
  non-nullable. (3) A stored URL on a foreign host (not ImageKit) is passed through — it was never private media of ours.
  (4) Share-page preview images get a 7-day window (bots fetch late; public posts of public accounts only).
- **WP-11 — D-09 varsayılanı uygulandı:** Redis revocation list checked in `protect`; `requireActiveSession` (DB) on
  account deletion, export, profile update (covers e-mail change) and privacy settings.
- **WP-01 — plan dışı karar:** `OwnerRead.generation` is `number | null` (null = no usable cache, nothing is
  written) and `OwnerRead` carries `hit`, so a cached `false`/`null` value is distinguishable from a miss.

## Final verification (Section 9, 2026-11-07)

Code side:

- [x] `pnpm lint` 4/4, `pnpm typecheck` 6/6.
- [x] Shared tests 36/36; backend unit 113/113 (89 at the start).
- [x] Backend integration 87/87 against PostgreSQL 18, Redis 8 and RabbitMQ 4.2
      (21 at the start); `auditRegressions.test.ts` has no `todo` left.
- [x] `poolSelfDeadlock.test.ts` passes.
- [x] Export positive/negative/abort/failure tests pass on real PostgreSQL.
- [x] Cache race and per-field TTL tests pass on real Redis.
- [x] Message sync tests (paging 200, deletions, read position, 40 concurrent writers) pass.
- [x] Media signing unit tests and hydration integration tests pass.
- [x] Migrations 001–017 on an empty database, then again as a no-op; 016 and 017
      `down`×2 / `up`×2 verified.
- [x] Authorization sweep updated (locked-profile fields, export ownership, remove
      follower) — **not run**: it needs a stack built from this branch (the running
      8088 rehearsal stack is the user's and runs the old code).
- [x] Web build (1 m 48 s), `check:artifact` (incl. the new `/health/ready` rule) and
      `check:performance` pass.
- [x] Mobile configuration check passes. **No new native dependency** (export uses the
      already installed `expo-file-system`/`expo-sharing`): no new APK is required by
      this work, though a new JS bundle is.
- [x] `scripts/tests` 22/22; dependency audit: high 0, critical 0. Moderate
      `glob@13.0.6` (GHSA-3g3m-2fjr-6pw4) and `minimatch@10.2.5` (GHSA-g3hv-75wg-m249)
      come only through `expo` → `@expo/cli` / `@expo/fingerprint` (mobile build
      tooling). The fixes are major versions those packages pin; overriding them would
      change the Expo toolchain the APK and Expo Go builds rely on, so they are left
      below the gate and should be re-checked with the next Expo SDK patch.
- [x] Section 8 documents updated (see each WP's commit).

## External review 2026-11-07 — hardening round

Branch `audit/2026-11-hardening`. Each finding of the external review, checked
against the code first, then fixed or explicitly decided. "Reviewer" is the
review's own numbering.

| Reviewer | Finding (verified) | Change | Tests |
| --- | --- | --- | --- |
| 1 | `trust proxy 1` behind TLS proxy + nginx resolved every client to the TLS proxy: every limit was one global budget; session addresses wrong | `TRUST_PROXY` (hop count, `false` or addresses/CIDRs), required for the API in production; limiters keyed per member after `protect`, per verified token before it, per session for refresh, per address + e-mail hash for login and reset, IPv6 /56; login and reset also get an address-wide budget; register 5 → 10/h (CGNAT) | `clientIdentity.test.ts` (real Express: old setting sees 10.0.0.5, new sees the client, forged XFF ignored), `environment.test.ts` |
| 2 | bcryptjs cost 12 on the event loop (~255 ms of blocked loop per check); reset hashed before checking the token; unknown e-mail answered at once | `utils/passwordHashing.ts`: the same bcryptjs, hash format and cost in a bounded worker-thread pool (`PASSWORD_HASH_WORKERS`), queue capped (503 + metric past it); token checked before hashing; unknown accounts checked against a real dummy hash; forgot-password answers before any lookup (timing and SMTP latency) | `passwordHashing.test.ts` (5 ms timer keeps firing, longest gap < 150 ms with 4 checks in flight) |
| 3 | Refresh rotation without grace: lost response or two tabs signed members out; no reuse detection | Migration 018 (`previous_token_hash`, `rotated_at`); successor derived with an HMAC so a repeat within 60 s gets the same token; the replaced token after 60 s revokes the session (`refresh_token_reuse_detected`); mobile socket no longer forces a refresh on every connect | `refreshRotation.test.ts` (lost answer, two tabs racing, reuse revokes, older tokens refused without revoking, logout with the previous token) |
| 4 | 5xx logs empty in production; 4xx logged as errors | `errorDiagnostics`: masked message and stack, PostgreSQL constraint/table/column, never `detail`; 5xx error, 4xx info (`request_rejected`); used for every unexpected failure (uncaught, startup, consumers, scheduler, sockets) | `errorLogging.test.ts` (signed URLs, e-mails, credentials and JWTs masked) |
| 5 | Single host, no limits on the API, no heap setting | API 2 CPU / 1 GB, heap limits on every Node process, web limits, 15 s stop grace; nginx: kept-alive upstream with runtime DNS (`resolve`), request ids, JSON access log without query strings, optional real-ip include; base image pinned by digest; alert rules for process down, 5xx ratio, p95, event-loop lag, sign-in saturation; new E2E CI job against the production images. Multi-host, restore drill and soak remain Ek B | `nginx -t` (1.30.6) with and without the include; merged compose `config` |
| 6 | Every deletion / privacy change bumped a global epoch: every member's feed cache missed at once | Retractions: a sorted set read with `ZMSCORE` over the page's own ids; deleted posts always filtered, an author's posts only on pages read before their retraction and written before it; epoch still read (operator switch, mixed-version deploys) | `feedPrivacy.test.ts` (+2: unrelated caches survive a deletion; going private) and the existing privacy tests |
| 7 | Presence via `fetchSockets()` on every connect/disconnect, connection list read twice, no socket limits | Presence in Redis (sorted set per member, 30 s heartbeat, 90 s TTL); one connection-list read per socket, reused for the offline notice; handlers registered before any await; ≤ 10 sockets per member per replica and 30 connects/min; 64 KB frames; clients reconnect with full jitter | `presenceAndLeases.test.ts` |
| 8 | Account deletion in one transaction could exceed the 15 s timeout and locked other members' rows | Sessions revoked first; likes, comments, reactions to own posts, posts, workouts, notifications, follows and connections in 1 000-row batches with exact counter fixes; final step on a maintenance connection (5 min cap); conversations still cascade whole (no tombstones). **New finding:** nine foreign keys that cascade/set null had no index (migration 019) - every post deletion and story expiry scanned `notifications`, every message deletion scanned `conversations` | `accountDeletion.test.ts` (2 300 posts, > 1 batch each way, all counters back), `databaseContracts.test.ts` (every cascading FK indexed) |
| 9 | `user.profile.updated` rewrote all of an author's posts in one transaction | `hydratePosts` reads author name/picture live (one PK query per page, in parallel); projection now only writes rows that differ, 1 000 per statement, as an idempotent external consumer | `outbox.test.ts` (projection), feed/profile tests |
| 10 | Session-level advisory locks break behind a transaction-mode pooler | Scheduled tasks hold a lease row (migration 020, 60 s, renewed every 20 s); PgBouncer notes in DEPLOYMENT.md (statement_timeout, migrate directly) | `presenceAndLeases.test.ts` (expired lease taken over), `outbox.test.ts` |
| low | `docs/production.md` checked `/health/ready` publicly | Uses the private ops port | — |
| low | nginx without keepalive | Done (5) | — |
| low | No E2E in CI | `e2e-stack` job: production images + local data services, authorization sweep. Its first run found the profile check sending `id`/`userId` instead of `profileId`: refused as a bad id, it had passed on an empty answer; it now sends what the clients send and requires a 200 | `authorization.e2e.test.ts` 12/12 against the compiled API (`dist`, plain `node`, production mode, the job's environment); images not built locally while the rehearsal stack is up |
| low | AdMob on test units | Deliberate (no production ad units exist, docs/mobile-admob.md); needs AdMob console ids, not code | — |

Found in the same pass, outside the review's list:

- Multipart uploads are read into memory (a post: 4 × 20 MB) with no
  concurrency bound: a burst could OOM the API. Process-wide upload memory
  budget (192 MB, 503 past it, 413 for oversize declarations) and a per-member
  upload limit; share cards (sharp, libuv pool) got a per-member limit and
  one libvips thread per image. `uploadBudget.test.ts`.
- Feed videos built a native player (decoder, surface, buffer) for every video
  card in the list window, unwatched. Now tap-to-play, paused when the screen
  loses focus (`PostCard.tsx`).
- No `idle_in_transaction_session_timeout`: a transaction left open held its
  locks indefinitely. 60 s on the request pool.
- `outbox.test.ts` made a dead-lettered event due with the test process's
  clock while the claim compares with PostgreSQL's `now()`; with Docker
  Desktop's VM clock a few milliseconds behind, it failed now and then. It
  uses the database clock, as the code does.

Not changed, with reason: R8 stays off in release builds (device crash,
`plugins/withReleaseMinifyOff.js`; needs keep rules tested on a device); an
image vulnerability scanner in CI is recommended but not added (third-party
actions must be pinned to a reviewed commit, which could not be verified
offline).

Verification (2026-11-07): backend unit 132/132; integration 99/99 against
PostgreSQL 18, Redis 8, RabbitMQ 4.2 (migrations 018-020 applied, second run a
no-op); E2E authorization sweep 12/12 against the compiled API and worker in
production mode (password checks on worker threads under plain `node`);
`pnpm lint` and `pnpm typecheck` clean across the monorepo; web build,
artifact and performance checks clean; `scripts/tests` 22/22; Node security
scan clean; nginx `-t` clean; merged compose valid.

## Environment-only work (Ek B)

| # | Needed for | What is ready in the repo |
| --- | --- | --- |
| B-1 | WP-06 | `infra/s3/user-media-bucket-policy.example.json`, RUNBOOKS "Media access hardening" |
| B-2 | WP-06 | Rollout order in DEPLOYMENT.md; verification steps in RUNBOOKS |
| B-3 | WP-06 | `IMAGEKIT_PURGE_ON_DELETE` (off); purge in the deletion job; wildcard and quota to confirm |
| B-4, B-5 | MM-SEC-03 | Unchanged by this work |
| B-6 | WP-20 | `infra/prometheus/` scrape + alert examples |
| B-7 | MM-OPS-04 | RUNBOOKS "Restore drill" (unchanged) |
| B-8 | WP-17, WP-19 | `docker-compose.replicas.yml`, RUNBOOKS "Two-replica rehearsal" (incl. presence cost) |
| B-9 | WP-20 | Connection budget table in DEPLOYMENT.md, pool gauge |
| B-10 | WP-05 | RUNBOOKS "Migration 016 … on a large `messages` table" |
| B-11 | WP-04, WP-05, WP-06 | New JS bundle on a device: export shared as a file, chat catch-up after background, media placeholders |
| B-12 | WP-20 | `scripts/load` (hot-thread comments added to the seed) |
| B-13 | — | Node.js security release pins (unchanged) |
