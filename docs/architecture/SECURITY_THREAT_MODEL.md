# Threat model (delta for this architecture work)

Scope: what the process split, the broker and the media changes added or
changed. The existing controls (bcrypt, JWT issuer/audience, rotating refresh
sessions, CSRF header, CORS allowlist, Helmet, rate limits, SSRF-bounded fetch)
are unchanged and covered by `docs/security-verification/`.

| Threat (STRIDE) | Where | Control |
|---|---|---|
| Spoofing: a stolen access token keeps a socket alive after logout | Socket.IO | Handshake requires an active session; logout, password reset and account deletion disconnect the session's or member's sockets on every instance; open sockets re-check every ~10 min |
| Spoofing: forged event on the broker | RabbitMQ | Broker on a private network, per-deployment credentials, `amqps://` required in production (`ALLOW_INSECURE_RABBITMQ_TLS` only for a private network); consumers re-read state instead of trusting payloads |
| Tampering: client claims a file is an image | upload | Server checks S3 stored type, size bounds and the file's leading bytes before attaching; post type derived from the files, not from the request |
| Tampering: attaching someone else's upload | post/story/message create | Reservation must match owner, purpose and expiry; duplicates refused |
| Repudiation | worker actions | Every log line carries the originating trace id; outbox rows kept 7 days after delivery |
| Information disclosure: cached pages after access is withdrawn | feed/profile cache | Both members' caches dropped on removed connection/unfollow; audience epoch retires all pages when an account goes private or content is deleted |
| Information disclosure: workout hidden from feed reappears | post create | Any post carrying a workout is stored as `workout`, so the feed filter applies |
| Information disclosure: internals via metrics | ops port | Separate port, not routed by the proxy, low-cardinality labels with no ids |
| Information disclosure: PII in events | outbox/broker | Payloads are ids and scalars; no tokens, URLs, emails, message bodies or coordinates (EVENT_CATALOG.md) |
| Denial of service: poison message blocks a queue | consumers | Malformed or permanently failing messages go to `.dead`; delivery limit for crash loops; bounded prefetch |
| Denial of service: decompression bomb | media worker | sharp `limitInputPixels` 100 MP; at most 256 KB read, 25 MB fallback |
| Tampering / DoS: hostile video file | media worker (FFmpeg) | ffprobe only (no decoding to disk), https-only protocol whitelist, bounded probe size and analyse duration, 30 s timeout, non-root read-only container; FFmpeg is absent from the API image |
| Information disclosure: signed URL in logs | media worker | ffprobe failures are logged by exit code only; execFile's message, which carries the command line, is never logged or stored |
| Elevation: access through cached privileges after a role/privacy change | feed, sockets | access is re-evaluated on every single-post read; feed caches retired on access-narrowing writes; socket permission cache invalidated across instances |
| Denial of service: retry storm | outbox/consumers | Jittered exponential backoff, attempt ceilings, TTL retry tiers |
| Elevation: worker credentials | deployment | Same least-privilege DB user as the API today; a separate role per process is a follow-up |

## Open items

- Separate PostgreSQL roles per process role (API needs no DDL; the migrate
  job does).
- RabbitMQ: a dedicated vhost and user with configure/write/read limited to
  `motionmeet.*` — documented in DEPLOYMENT.md, applied on the broker, not here.
- Node.js announced a HIGH-severity security release for 22.x/24.x/26.x on
  or after 11 November 2026; the pinned 22.23.4 / 24.22.1 must be raised
  (engines, Dockerfile digests, `scripts/check-node-security.mjs`, CI matrix)
  when it ships.
