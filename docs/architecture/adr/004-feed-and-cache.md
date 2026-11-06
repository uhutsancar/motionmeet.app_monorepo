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

## Consequences

An epoch bump turns the next request of every active member into a cache miss.
These writes are rare next to reads, and the single-flight guard keeps one
member's concurrent misses to one query.

## Revisit when

- Epoch bumps per minute become a visible share of cache misses (count the
  `INCR`s, or compare feed p95 around them).
- Feed p95 or database CPU fails its target with real traffic — then consider
  hybrid fan-out for ordinary accounts with read-time merge for very large ones.
