# ADR 004 — Read-time feed, owner-addressed cache, access epoch

Status: accepted, November 2026.

## Context

Feeds are computed at read time from `posts` with keyset pagination and cached
per viewer in Redis for 30 seconds, under one hash per viewer so invalidating a
member is a single `DEL`. Writes drop only the actor's own cache.

That narrowing is right for counts and new content, and wrong for anything that
*removes* access: a removed connection and an account going private both left
other members' cached pages serving content they could no longer see.

## Decision

- Keep the read-time feed. There are no measurements showing it is too slow,
  and fan-out on write would add a derived store that every privacy change must
  also scrub.
- Writes that narrow access **between two known members** (unfollow, removed
  connection, declined request) drop both members' feed and profile caches.
- Writes that narrow access **for an audience nobody can list** (account goes
  private, workouts hidden, post deleted, account deleted) increment a
  Redis counter, the feed audience epoch, which is the first part of every feed
  cache field name. One `INCR` retires every cached page.
- The access check itself never depends on the cache: single-post, comment,
  like and share-card endpoints evaluate access on every request.

## Home feed read path (second pass)

Measured on 300 000 posts, the original home-feed query scanned every public
and followers-only post and tested each against the graph (4–8 s). It now
reads audience-first: list the viewer, their followees and connections; walk
each one's newest posts on the covering `posts_author_timeline_idx`
(index-only, stopping at the page size); fetch rows for the final page only.
Cost scales with the audience, not the table. A viewer following thousands
of accounts makes thousands of short index walks — fine at today's follow
cap, and the point to revisit before raising it.

## Cache entries: envelope and owner generation (2026-11 audit, WP-01)

Two defects of the plain per-owner hash were reproduced against real Redis:
a hash has a single TTL, so refreshing it on every write kept old fields alive
past their own TTL; and `DEL` loses a race — a request that read PostgreSQL
before a write committed could store its result after that write's `DEL`, and
the stale page (possibly one the viewer may no longer see) was served until
the TTL.

- Every field is stored as an envelope `{ v, g, x, d }`: format version, the
  owner's generation when the source data was read, absolute expiry, data.
  A read is a hit only when all three match (`v` current, `x` in the future,
  `g` equal to the owner's current generation).
- Invalidation is `MULTI INCR gen:<owner>; EXPIRE gen:<owner> 86400; DEL <owner>`.
  The generation bump is what makes it race-safe; `DEL` only frees memory.
- `cachedOwnerField` is the only read-through path. Its single-flight key
  carries the generation, so a request that starts after an invalidation never
  joins a computation that began before it.
- The key prefix moved from `motionmeet:v1:` to `motionmeet:v2:`; old entries
  are never read.

**Guarantee (D-10).** When Redis is reachable and the invalidation succeeds, a
read that starts after the mutation's successful response does not see the old
data. The invalidation is retried synchronously (first attempt + 3 retries at
50/150/400 ms); if it still fails, the mutation stays successful (it is
committed), `motionmeet_cache_invalidation_failures_total` is incremented and
`cache_invalidation_failed` is logged, and staleness is bounded by the entry's
TTL: feed 30 s, nearby 45 s, profile 60 s. This includes writes that narrow
privacy (unfollow, removed connection, account going private); the TTL is the
accepted upper bound for that failure case. A Redis read error is always a
miss, never a "last known" value. A stronger guarantee would need a database
check on every read, which is what the cache exists to avoid.

Processes that never connect to Redis (worker, scheduler) have no cache and
skip invalidation; all cache-relevant writes happen in the API process.

## Profile cache (2026-11 audit, WP-02)

A profile is cached per viewer under one owner (`profile:<authorId>`), so one
invalidation reaches every viewer. Creating a post, deleting a post and
logging a workout now invalidate the author's profile as well as their feed
(previously a new post stayed missing and a deleted one stayed visible on the
profile for up to 60 s, R1/R2). Like and comment counts are left to the TTL,
as on the feed.

**Deleted content.** When Redis is reachable and the invalidation succeeds,
reads that start after a delete request has answered successfully do not see
the deleted post on the profile, the feeds or the single-post view (the last
never uses the cache). Otherwise the post can stay on a cached profile for at
most the profile TTL (60 s) and on a cached feed page for at most 30 s.

## Nearby: privacy is applied at read time (2026-11 audit, WP-03)

The nearby cache used to hold finished cards. A member who switched
visibility off, deleted their location, left search, deleted their account or
set their distance to "hidden" therefore stayed in other members' cached
results — band and area label included — for up to 45 s (R3, R7, NEW-05).
Only the searcher's own cache was ever dropped.

Decision: the cache holds only the expensive part, the ordered candidate ids
with their distance rounded to 100 m (internal; never returned or logged).
Every request, hit or miss, re-reads those candidates' current switches,
labels and follow state in one primary-key lookup (≤ 50 ids, index scans on
`user_locations_pkey` and `users_pkey`) and drops anyone who no longer
qualifies. Band and area label come from the current `distance_visibility`.
Opting out therefore takes effect on the very next request of every other
member, independent of Redis.

Not done: a global nearby epoch. Bumping it on every GPS update would retire
the whole system's results on each fix. A target's *position* can be up to
45 s old in someone's cached candidates — that moves them between bands, it
never shows someone who opted out. `lastActiveAt` is reported to strangers
rounded down to the hour.

## Consequences

An epoch bump turns the next request of every active member into a cache miss.
These writes are rare next to reads, and the single-flight guard keeps one
member's concurrent misses to one query.

## Revisit when

- Epoch bumps per minute become a visible share of cache misses (count the
  `INCR`s, or compare feed p95 around them).
- Feed p95 or database CPU fails its target with real traffic — then consider
  hybrid fan-out for ordinary accounts with read-time merge for very large ones.
