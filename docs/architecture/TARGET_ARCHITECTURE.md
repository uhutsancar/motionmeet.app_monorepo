# Architecture — as implemented

A modular monolith deployed as several processes from one backend image.
PostgreSQL is the source of truth; Redis, RabbitMQ and Socket.IO carry
traffic but never hold the only copy of anything.

```
   Web (React/Vite, static)          Mobile (Expo/RN)
              │  HTTPS / WSS               │
              └──────────────┬─────────────┘
                     reverse proxy / CDN
                             │
                ┌────────────┴────────────┐
                │  backend  (role: api)   │  Express 5 + Socket.IO
                │  RUN_SCHEDULED_JOBS=false│  no background work in production
                └──┬───────────┬──────────┘
                   │           │ Redis: cache, rate limits, Socket.IO adapter
                   │           └──────────────────────────────┐
         PostgreSQL 18 (Kysely)                              Redis
         domain rows + outbox_events in one transaction
                   │
       ┌───────────┴──────────────┐
       │ worker (role: worker)    │  outbox relay ──► RabbitMQ (OUTBOX_TRANSPORT=rabbitmq)
       │                          │  consumers ◄──── motionmeet.<consumer> queues
       │                          │  or, without a broker, applies events in-process (direct)
       └──────────────────────────┘
       ┌──────────────────────────┐
       │ scheduler (role: scheduler)│ housekeeping, each task under a PG advisory lock
       └──────────────────────────┘
       migrate (one-shot) runs before the others on every deploy

   S3 (originals) ── ImageKit (transformed delivery)
   Every process: private ops port (METRICS_PORT) with /metrics and /health/*
```

## Processes

| Role | Entry point | Does | Scales |
|---|---|---|---|
| `api` | `server.ts` | HTTP API, Socket.IO, synchronous upload verification | Horizontally; Redis required for >1 replica (`READINESS_REQUIRE_REDIS=true`) |
| `worker` | `entrypoints/worker.ts` | Outbox relay; event consumers (`messaging/consumers.ts`) | Horizontally; outbox claims skip each other, a queue load-balances its consumers |
| `scheduler` | `entrypoints/scheduler.ts` | Story expiry, abandoned uploads, usage counters, media deletions, event-history retention | Any number; each task holds a PostgreSQL advisory lock |
| `migrate` | `scripts/migrate.ts` | Schema migrations, then exits | One per deploy |

For local development the API still does everything in one process when
`RUN_SCHEDULED_JOBS` is unset (it runs the scheduled tasks and the direct
outbox relay itself), so `pnpm dev` needs nothing new.

## Synchronous and asynchronous boundaries

Synchronous (the user waits): authentication, authorisation, the write itself
and the checks that keep bad data out — including the S3 HEAD and 32-byte
signature read of each uploaded file, because an unverified object must never
be attached to visible content.

Asynchronous (after commit, through the outbox): anything that can lag without
being wrong — copying a renamed author onto their posts, emailing a connection
request, measuring images. See [EVENT_CATALOG.md](EVENT_CATALOG.md).

Realtime: a message is committed to PostgreSQL and then emitted; the emit is a
notification, not the delivery guarantee. Clients reconcile from the API on
every reconnect.

## Key flows

**Post with photos.** Client sniffs 32 bytes and the on-disk size → `POST
/api/media/presign` (reservation row) → native PUT straight to S3 with progress
→ `POST /api/post` with `uploadedKeys` → server HEADs and signature-checks each
key, then in one transaction inserts the post, one `post_media` row per file
with its verified MIME and size, consumes the reservations and writes a
`media.uploaded` outbox row → response. The worker later measures the images
and fills `width`/`height`.

**Profile rename.** `users` update + `user.profile.updated` outbox row in one
transaction → relay → (RabbitMQ) → `profile-projection` consumer rewrites the
author snapshot on the member's posts, deduplicated by `processed_events`.

**Logout.** Session revoked → the session's sockets are disconnected on every
instance through the adapter; open sockets also re-check their session.

## Deliberately not added

Kafka, Kubernetes, a second database, an ORM change, GraphQL/tRPC, a search
engine, feed fan-out, HLS transcoding and any payment code. ADRs
[001](adr/001-modular-monolith-workers.md), [002](adr/002-rabbitmq-transactional-outbox.md),
[003](adr/003-media-lifecycle.md) and [004](adr/004-feed-and-cache.md) give the
reasons and the measurements that would change them.
