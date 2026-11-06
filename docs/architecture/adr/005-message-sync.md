# ADR 005 — Message sync: per-conversation sequence numbers and tombstones

Status: accepted, November 2026 (2026-11 audit, WP-05).

## Context

A chat client loses its socket all the time: the app goes to the background,
the network changes, a laptop sleeps. Messages are persisted before they are
emitted, so nothing is lost on the server, but the client has to find out
what it missed. Until now it re-fetched the newest 50 messages and merged
them. That fails in three ways:

- **Missed messages.** More than 50 messages, and the gap is never filled.
  A "newer than the last one I have" cursor would not fix it:
  `messages.created_at` is `now()`, the start of the inserting transaction,
  and ids are random UUIDs. Two writers to one conversation serialise on the
  conversation row; the one that started first can commit second, with the
  earlier timestamp. A client that synced between the two commits never sees
  the first message.
- **Deleted messages stay.** Deleting a message is a hard delete
  ("delete for everyone", D-06). Nothing records it, so a client that was
  offline keeps showing it.
- **Side effects.** The reconnect fetch marked the conversation read and
  emitted `messages_seen`, even when nobody was looking at it; paging back
  through history emitted `messages_seen` as well (NEW-16).

The web socket also gave up for good after ten reconnection attempts.

## Decision

### Data model (migration 016)

- `conversations.last_seq` — a per-conversation counter.
- `messages.seq` — assigned by a `BEFORE INSERT` trigger:
  `UPDATE conversations SET last_seq = last_seq + 1 … RETURNING last_seq`.
  Every writer to a conversation already locks its row (`createMessage`
  upserts it first), and the lock is held to commit, so **seq order is
  commit order**. The counter and the message commit together, so a reader
  whose snapshot shows `last_seq = N` sees every event numbered up to N.
- `message_deletions (message_id, conversation_id, change_seq, deleted_at)` —
  a tombstone per deleted message, written by an `AFTER DELETE` trigger that
  takes `change_seq` from the same counter. No foreign key: when a whole
  conversation is deleted (last message gone, account deleted) the trigger
  finds no conversation row, writes nothing, and sync reports the
  conversation as gone.
- `conversations.tombstone_floor_seq` — tombstones are kept 30 days (D-06);
  the daily `message-tombstone-retention` task deletes older ones, removes
  orphans, and raises the floor to the highest number it purged.

Sequence numbers are **not contiguous**: deletions use numbers from the same
counter. A client must never read a gap as "a message is missing".

Both triggers live in the database, not in application code, so an API
replica still running the previous release during a rolling deploy numbers
what it inserts and leaves a tombstone for what it deletes.

The partner's read position is not stored. It is computed per request from
`messages.seen`: one before the first unseen message to the partner, or
`last_seq` when nothing is unseen. Seen-marking is all-at-once, so this is
exact in practice and conservative otherwise (never shows more as seen); a
member's own messages never count as evidence they read the other side's.

### API

`POST /api/message/sync` with `{ to_user_id, conversationId?, afterSeq, limit? }`
returns messages and deletions after `afterSeq` as **one event stream** in
sequence order, cut at one `limit` (1..200, default 100), plus
`nextAfterSeq` (the cursor for the next request), `hasMore`, `latestSeq`
(informational, never a cursor), `partnerLastReadSeq`, `conversationId`,
`conversationGone` and `resyncRequired`. All reads share one
`REPEATABLE READ READ ONLY` snapshot. It marks nothing seen and emits nothing.

`resyncRequired` is set when the cursor cannot be continued: the
conversation was deleted and recreated (`conversationId` differs; numbering
restarted), the cursor is below the tombstone floor, or ahead of `latestSeq`.

Unchanged and still supported: `/api/message/get` and its `nextCursor`
history paging. Messages now carry `seq`; `messages_seen` carries
`lastReadSeq`, and is emitted only by the first `/get` page and by `/seen`.

### Clients (web and mobile, shared pure functions in `packages/shared/src/messageSync.ts`)

1. Per open conversation, `{ conversationId, cursor }`; after the first `/get`
   page, `cursor = max(seq)`.
2. On reconnect (mobile: also every return to the foreground, which
   reconnects), and whenever a socket message is not exactly `cursor + 1`,
   run the sync loop: request from `cursor`, apply the page, set
   `cursor = nextAfterSeq`, repeat while `hasMore`, at most 20 pages. A loop
   cut short keeps the cursor of the last applied page; the next run
   continues without repeating or skipping anything.
3. Applying a page: messages deduplicated by id and ordered by seq,
   deletions removed (unknown ids ignored), own messages up to
   `partnerLastReadSeq` marked seen.
4. `resyncRequired`, `conversationGone` or too many pages: reload the newest
   page. `/sync` answering 404 (an older backend): merge the newest page as
   before.
5. A response for a conversation the member has since left is discarded
   (request generation).
6. A socket message advances the cursor only when no sync is running and it is
   exactly `cursor + 1`.
7. After a sync that brought messages, a visible conversation is marked read
   explicitly with `/seen`.
8. On reconnect the conversation list (unread counts) is fetched again.
9. The web socket retries forever (backoff up to 30 s) and reconnects at once
   on `online` and when the tab becomes visible; mobile retries forever too.

## Rollout

| Step | Running | Behaviour |
| --- | --- | --- |
| 1. Migration 016 | old API, old clients | Triggers number the old API's inserts and record its deletes; old clients see nothing new |
| 2. New backend (mixed replicas) | old + new API | `/sync` exists only on new replicas; a 404 from an old one makes the client fall back. Data consistency is in the database, so mixing is harmless |
| 3. Web, then mobile | new API | Sync in use; old mobile builds keep using `/get` |
| Roll back | — | Clients first (or leave them: they tolerate 404), then the backend, then if needed migration 016 `down` |

## Consequences

- One extra `UPDATE` of the (already locked) conversation row per insert and
  per delete.
- The backfill in migration 016 rewrites every message row once, under an
  exclusive lock; measure it on a staging copy before production
  (RUNBOOKS.md, "Migration 016").
- Tombstones cost one small row per deleted message for 30 days.

## Tests

`packages/backend/tests/integration/messageSync.test.ts` (commit order under
40 parallel writers with a reader syncing throughout, paging 200 messages,
interleaved deletions on one boundary, offline insert+delete, legacy delete,
gone/recreated conversations, tombstone floor, read position, read-only,
stranger access, backfill) and `packages/shared/tests/messageSync.test.ts`.
Real-device and browser reconnect flows are not automated (Ek B-11).
