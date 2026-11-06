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
| WP-04 | NOT_STARTED | | | |
| WP-05 | NOT_STARTED | | | |
| WP-06 | NOT_STARTED | | | |
| WP-07 | DONE | see `git log --grep WP-07` | `auditRegressions.test.ts` R6b + positive follower/public checks | D-04 default applied. Old store builds: no release tags in the repo; the last 60 mobile commits never read `statistics`/`weight`/`height` of another member without optional chaining, so `null` is safe for them |
| WP-08 | NOT_STARTED | | | |
| WP-09 | NOT_STARTED | | | |
| WP-10 | NOT_STARTED | | | |
| WP-11 | NOT_STARTED | | | |
| WP-12 | NOT_STARTED | | | |
| WP-13 | NOT_STARTED | | | |
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
- **WP-01 — plan dışı karar:** `OwnerRead.generation` is `number | null` (null = no usable cache, nothing is
  written) and `OwnerRead` carries `hit`, so a cached `false`/`null` value is distinguishable from a miss.

## Environment-only work (Ek B)

_(Filled in as WPs land.)_
