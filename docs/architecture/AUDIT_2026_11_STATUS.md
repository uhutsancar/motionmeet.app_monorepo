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
| WP-06 | BLOCKED-ENV | see `git log --grep WP-06` | `mediaDelivery.test.ts` (11, red first), `integration/signedMedia.test.ts` (4: feed/profile post media + variants, avatar, cover, story ≤ expiry, message photo, unresolvable → unavailable), `environment.test.ts`, shared `media.test.ts` (+2) | Code done: signing at read time on every hydration path, variants, placeholders (web + mobile), `backfill:media-keys`, optional purge, docs, example bucket policy. Remaining: Ek B-1 (S3 prefix policy), B-2 (ImageKit origin + "Restrict unsigned URLs"), B-3 (purge quota/wildcard) — and the rollout order in DEPLOYMENT.md |
| WP-07 | DONE | see `git log --grep WP-07` | `auditRegressions.test.ts` R6b + positive follower/public checks | D-04 default applied. Old store builds: no release tags in the repo; the last 60 mobile commits never read `statistics`/`weight`/`height` of another member without optional chaining, so `null` is safe for them |
| WP-08 | DONE | see `git log --grep WP-08` | `integration/notificationAtomicity.test.ts` (7: like, toggle-like, comment, follow/request/accept, story like each rolled back with their failing notification via a trigger; idempotent comment incl. a concurrent pair; throwing socket delivery does not fail the request); migration 017 down×2/up×2 verified | Delivery stays best effort (socket); clients send `operationId` for comments (web + mobile) and reuse it on retry |
| WP-09 | DONE | see `git log --grep WP-09` | `integration/poolSelfDeadlock.test.ts` (child process, `DATABASE_POOL_MAX=1`, 10 write paths each < 2 s) | Scan of every `withTransaction` block (accountService, authService ×2, exerciseService, measurementService, mediaDeletionService, mediaUploadService, messageService ×3, postInteractionService ×4, postService ×2, relationshipService ×4, routineService ×3, storyService ×2, userService ×4, workoutService, cronJobs ×2, consumers): the only helper reading through the global pool was `storyService.hydrate` (fixed). All other helpers called inside transactions either take the executor (`findHydratedPost`, `hydratePosts`, `findWorkoutById`, `applyWorkoutAnalytics`, `commitReservedUploads`, `queueMediaDeletions`, `enqueueOutboxEvent`, `reserveQuota`, `hydrateMessages`) or are pure |
| WP-10 | NOT_STARTED | | | |
| WP-11 | DONE | see `git log --grep WP-11` | `integration/sessions.test.ts` (+4: logout, password reset and account deletion refuse the old access token at once; sensitive routes refuse a revoked session without the Redis marker) | D-09 default applied. Accepted risk (in SECURITY_THREAT_MODEL.md): with Redis down, non-sensitive routes accept a revoked token for ≤ 15 min. There is no "log out all devices" endpoint to wire |
| WP-12 | DONE | see `git log --grep WP-12` | `integration/removeFollower.test.ts` (3: private account's posts/stories/cached feed/messaging lost, counters; idempotent; pending request dropped); e2e sweep scenario added | D-08 default applied: removal for public and private accounts, no blocking. UI: web and mobile Connections → Followers → Remove (with confirmation) |
| WP-13 | DONE | see `git log --grep WP-13` | `integration/retention.test.ts` (5: tasks scheduled; sessions; reset tokens; read notifications; stale location wipe keeps settings and drops out of nearby) | D-07 default applied (30 days). `lastActiveAt` to the hour was done in WP-03. Retention table in docs/database.md |
| WP-14 | N/A | | | The plan has no WP-14 (numbering skips from 13 to 15). |
| WP-15 | NOT_STARTED | | | |
| WP-16 | NOT_STARTED | | | |
| WP-17 | NOT_STARTED | | | |
| WP-18 | NOT_STARTED | | | |
| WP-19 | NOT_STARTED | | | |
| WP-20 | NOT_STARTED | | | |

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

## Environment-only work (Ek B)

_(Filled in as WPs land.)_
