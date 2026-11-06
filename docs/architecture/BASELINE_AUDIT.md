# Baseline audit — architecture plan, November 2026

Starting point for the work tracked in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).
Every finding below was checked against the code at the commit named here, not
taken from the plan or from older documents.

## Context

| Item | Value |
|---|---|
| Starting commit | `0774d92` on `main`, plus the uncommitted work snapshotted as `4e45dbc` |
| Working branch | `arch/master-plan` |
| Node / pnpm / Docker / Java | 24.22.1 / 11.10.0 / 29.8.2 / 19.0.2 |
| Tracked files | 545 |
| TypeScript source (excl. `dist`, `.d.ts`) | backend 162 files / 14.7k lines, web 103 / 17.6k, mobile 145 / 27.2k, shared 18 / 2.2k |
| Migrations at start | 12 (`001`–`013`, no `011`) |

The host disk is slow: a `pnpm add` of two packages took 18 minutes and the
backend lint about 90 seconds. Timings in this document are from that machine.

## Baseline commands (before any change)

| Command | Result |
|---|---|
| `pnpm --filter @motionmeet/backend typecheck` | pass (46 s) |
| `pnpm --filter @motionmeet/backend lint` | pass (94 s) |
| `pnpm --filter @motionmeet/backend test` | 67/67 pass (27 s) |
| `pnpm --filter @motionmeet/shared typecheck` / `test` | pass / 22/22 pass |
| Root `pnpm test`, `pnpm build`, web artifact/performance checks | NOT_RUN at baseline (≈15 min on this disk; run per package instead) |
| Android/iOS release build, device smoke | NOT_RUN (no device session in this work) |

## Documents that no longer match the code

(Snapshot of the starting point. All three items were brought up to date in
the documentation pass of 2026-11-06.)

- `PROJECT_STRUCTURE.md` describes Expo SDK 54 / React Native 0.81.5. The
  mobile `package.json` has Expo `^58.0.19`, React Native `0.88.0`.
- The plan's file references use `packages/backend/src/...` and
  `src/sockets/...`. The backend is flat: `packages/backend/{services,controllers,realtime,workers,...}`.
- `outbox_events.type` and `status` were PostgreSQL enums; they are text with
  CHECK constraints from migration `014`.

## Plan findings (§2.1), verified

| # | Finding | Verdict | Evidence at start | Outcome |
|---|---|---|---|---|
| 1 | Mobile upload reads the whole file into a JS Blob; the 60 s `Promise.race` does not stop the native upload | CONFIRMED | `mobile/src/api/mediaUpload.ts` `fetch(asset.uri).blob()`, `withDeadline(FileSystem.uploadAsync(...))` | Fixed in `22e1c24` |
| 2 | Empty-post check runs before presigned keys are resolved | CONFIRMED | `backend/controllers/postController.ts` checked `!content && images.length === 0 && !workout` before `resolveReservedUploads` | Fixed in `22e1c24` |
| 3 | `post_media` MIME from the post type; size/dimensions null | CONFIRMED | `backend/services/postService.ts` wrote `"video/mp4"` / `"image/*"` for every row | MIME + size fixed in `22e1c24`; width/height by the media worker in `dd87c53`; video duration open |
| 4 | S3 HEAD + 32-byte range GET on the create path | CONFIRMED | `backend/services/mediaUploadService.ts` `resolveReservedUploads` | Kept on purpose (security gate, two small parallel calls per file); heavy work moved to the worker — ADR 003 |
| 5 | Cron in the API process; outbox swept once a minute | CONFIRMED | `backend/workers/cronJobs.ts` `* * * * *` | Scheduler and worker processes; outbox relay polls every second (`387b101`) |
| 6 | Outbox: no attempt ceiling, no dead state | CONFIRMED | retried every ≤24 h forever, rows deleted on success | `dead` after 10 attempts, `published` kept for audit, redrive (`387b101`) |
| 7 | Media deletion jobs: 60 s lease, serial loop | CONFIRMED | `backend/services/mediaDeletionService.ts` | Unchanged logic (claim token per job, S3 delete is idempotent, keys are unique per upload); now runs under an advisory lock in the scheduler |
| 8 | Share card fetches a remote photo with no host allowlist | ALREADY FIXED in the snapshot | `backend/utils/boundedFetch.ts`: https only, host allowlist, `redirect: "error"`, streamed byte cap | Rendering still on the API path — NOT_MEASURED |
| 9 | Presence via `fetchSockets()` | CONFIRMED present | `backend/realtime/socketRegistry.ts` | Unchanged — NOT_MEASURED, single instance today |
| 10 | `/health/ready` is 200 with Redis down | CONFIRMED | `backend/server.ts` | `READINESS_REQUIRE_REDIS=true` for multi-replica deployments |
| 11 | `user.profile.updated` rewrites every post of the author | CONFIRMED | old `outboxService.applyEvent` | Now the `profile-projection` consumer; WAL cost NOT_MEASURED |
| 12 | `void publishNotification` after the DB row | CONFIRMED | `backend/services/postInteractionService.ts` | Kept: the activity row is durable and is what clients list; the socket push is a hint. Device push does not exist yet — see status |
| 13 | Story `expires_at = now + 24h` at create | CONFIRMED | `backend/services/storyService.ts` | Correct today: the story is created after its upload is verified, so creation is publication. Views and likes now also refuse expired stories |
| 14 | Composers await upload + create behind one spinner | CONFIRMED | mobile/web `StoryComposer`, `CreatePostModal` | Mobile shows percent and cancels on close; web API accepts progress/abort but its composers are not wired yet |
| 15 | Feed cache may leak after access is narrowed | CONFIRMED (two leaks) | `removeConnection` invalidated nothing; going private invalidated only the member's own cache | Fixed in `22e1c24` — ADR 004 |

## Additional findings during the work

| ID | Finding | Outcome |
|---|---|---|
| N1 | A socket authenticated once and stayed open through logout, password reset and account deletion | Fixed in `edd4ef2` |
| N2 | Chat loaded once; messages sent while the mobile socket was down (it disconnects in the background) stayed invisible until the chat was reopened | Fixed in `f7ba3cf` |
| N3 | A failed post/story/message create deleted the client's presigned objects, so a retry with the same keys failed as "expired" | Fixed in `22e1c24` |
| N4 | A workout attached under any `post_type` other than `workout` skipped the "show workouts on feed" privacy filter | Fixed in `22e1c24` |
| N5 | Views and likes were accepted on a story past `expires_at` until the next sweep | Fixed in `22e1c24` |
| N6 | With Redis down, every scheduled task ran on every replica (the lock fell back to "run anyway") | Fixed in `387b101` (PostgreSQL advisory lock) |
| N7 | Outbox claims compared PostgreSQL `now()` defaults with the Node clock; a few seconds of skew made due rows invisible (found by a flaky test) | Fixed in `387b101` — every outbox time is the database clock |

## Environment observation (not repository code)

A stale `motionmeet_prod` Compose stack is running on the development machine
(MongoDB-era images; its backend container is in a restart loop). It predates
the PostgreSQL migration and consumes resources; it was left untouched.
