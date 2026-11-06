# ADR 001 — Modular monolith, separate worker and scheduler processes

Status: accepted, November 2026.

## Context

All background work — the outbox, story expiry, upload cleanup, media
deletion — ran on `node-cron` timers inside the API process. A long sweep
shared the event loop with requests, an API restart cut sweeps short, the
outbox waited up to a minute, and with Redis down the "lock" let every replica
run every task.

## Decision

Keep one codebase and one image; run it as four roles (`api`, `worker`,
`scheduler`, one-shot `migrate`) selected by entry point and
`MOTIONMEET_PROCESS_ROLE`. Domain code stays where it is (`services/`,
`repositories/`); only the new seams got their own folders: `messaging/`
(events, consumers, broker), `observability/`, `runtime/`, `entrypoints/`.

Scheduled tasks take a PostgreSQL session advisory lock (`utils/advisoryLock.ts`)
rather than a Redis lease: PostgreSQL is already required by every process, a
dead holder's lock is released with its connection, and a slow run cannot
outlive a TTL.

## Not chosen

- **Microservices.** No team or scaling boundary needs them; they would add
  network hops and distributed transactions to a codebase that commits a post
  and its media in one transaction today.
- **Kubernetes.** Compose with health checks and resource limits covers the
  current deployment; revisit when there is more than one host to schedule.
- **Moving every module into `src/modules/*` now.** A big-bang move with no
  behaviour change risks regressions for no user-visible gain.

## Revisit when

- The API's p95 is dominated by CPU work that could run elsewhere (share-card
  rendering is the first candidate — measure `motionmeet_http_request_duration_seconds{route="/api/post/:postId/share-card"}`).
- Socket.IO connections need a different scaling curve from HTTP: split a
  `realtime` role out of `api` (same handlers, own deployment).
