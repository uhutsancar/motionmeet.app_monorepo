# Audit 2026-11 — implementation status

Single source of truth for the work packages in `MOTIONMEET_UYGULAMA_PLANI_v2.1.md`
(plan reviewed at commit `a8e1b17`). Branch: `audit/2026-11-implementation`.

Status values: `NOT_STARTED`, `IN_PROGRESS`, `DONE`, `BLOCKED`, `BLOCKED-ENV`
(code side done, the remaining acceptance step needs infrastructure — see Ek B).

| ID | Durum | Commit(ler) | Test(ler) | Kalan sınırlama |
| --- | --- | --- | --- | --- |
| WP-00 | DONE | see `git log --grep WP-00` | `tests/integration/auditRegressions.test.ts` (R1–R7 as `todo`) | Baseline: lint 4/4, typecheck 6/6, unit 89/89, integration 21/21 |
| WP-01 | NOT_STARTED | | | |
| WP-02 | NOT_STARTED | | | |
| WP-03 | NOT_STARTED | | | |
| WP-04 | NOT_STARTED | | | |
| WP-05 | NOT_STARTED | | | |
| WP-06 | NOT_STARTED | | | |
| WP-07 | NOT_STARTED | | | |
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

_(D-0x defaults and any decision the plan did not cover, recorded per WP.)_

## Environment-only work (Ek B)

_(Filled in as WPs land.)_
