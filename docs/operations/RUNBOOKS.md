# Runbooks

Commands assume the production compose project and a shell in a backend
container (`docker compose -f docker-compose.prod.yml exec worker sh`) or a
`psql` session against the production database with an operator role.

## Outbox backlog growing (`motionmeet_outbox_oldest_pending_seconds` high)

1. Worker health: `wget -qO- http://127.0.0.1:9464/health/ready` in the worker.
   `broker: disconnected` → see "RabbitMQ down". Not ready on `database` →
   PostgreSQL problem.
2. Why rows fail:
   ```sql
   select type, attempts, left(last_error, 120), count(*)
   from outbox_events where status in ('pending', 'processing')
   group by 1, 2, 3 order by 4 desc;
   ```
3. `No queue is bound for …` → the topology is missing a binding: deploy a
   worker whose consumer list includes that event type.

## RabbitMQ down

Nothing is lost: rows stay `pending` in PostgreSQL and the API keeps working.
The worker reconnects on its own (backoff up to 30 s) and publishes the
backlog. If the outage will be long and the events matter now, switch the
worker to `OUTBOX_TRANSPORT=direct` (DEPLOYMENT.md) — consumers are the same
code and deduplicate.

## Dead events

Outbox (`status = 'dead'`, exhausted 10 attempts):
```sql
select event_id, type, attempts, last_error, updated_at from outbox_events
where status = 'dead' order by updated_at desc limit 50;
```
Fix the cause first, then redrive (idempotent consumers make a redrive safe):
```sh
node dist/scripts/redriveOutbox.js <event-id> [...]     # in a backend container
pnpm --filter @motionmeet/backend outbox:redrive <event-id> [...]   # from a checkout
```
Omit the ids to redrive every dead row.

Broker dead-letter queues (`motionmeet.<consumer>.dead`): inspect messages in
the management UI (headers `x-mm-error`, `x-mm-failed-at`). After fixing the
cause, move them back with a shovel or the UI's "move messages" to
`motionmeet.<consumer>`. Malformed envelopes cannot succeed — delete those.

## Retry storm / consumer failing every message

`rate(motionmeet_events_consumed_total{outcome="retried"})` climbing for one
consumer usually means its dependency is down (SMTP for
`connection-request-email`, S3 for `media-metadata`). Retries are tiered up to
30 minutes, so the queue does not spin. If the dependency will stay down,
scale that consumer's worker to zero or stop it; messages wait in the queue.

## Changing queue arguments (TTL, queue type, delivery limit)

A re-declaration with different arguments fails with `PRECONDITION_FAILED` and
the worker keeps reconnecting. To change them: stop publishing
(`OUTBOX_TRANSPORT=direct` for a moment), let the queue drain, delete the
queue and its `.retry.*` queues in the management UI, deploy the new worker.

## Scheduler not running tasks

`motionmeet_scheduled_task_runs_total{outcome="skipped_locked"}` only rising →
another process holds the lock. Find it:
```sql
select pid, application_name, state, query_start from pg_stat_activity
where pid in (select pid from pg_locks where locktype = 'advisory');
```
A crashed holder releases the lock with its connection; a hung one can be
ended with `select pg_terminate_backend(<pid>)`.

## Redis down

Single API replica: degraded but serving (cache misses, local rate limits).
Several replicas: with `READINESS_REQUIRE_REDIS=true` they report not-ready
and leave the load balancer, because cross-node Socket.IO and shared rate
limits need Redis. Clients reconnect and re-fetch messages when it returns.

## Rolling back migration 014

Only if a release older than migration 014 must run against this database.
`down` deletes `published` outbox rows (already delivered), turns `dead` back
into `pending`, drops `processed_events` and restores the enums. Run it with
the Kysely migrator from a maintenance shell; take a backup first.

## Migration 016 (message sync) on a large `messages` table

The migration adds `messages.seq`, numbers every existing message in one
`UPDATE` and adds a unique index, all in the migrator's single transaction.
`ALTER TABLE` takes an exclusive lock on `messages` for the duration, so
sends and reads of messages wait.

1. Restore a recent snapshot into staging and time `node dist/scripts/migrate.js`
   there. Under a few seconds: run it in the normal release.
2. Longer: deploy it in a quiet window, or split it by hand first - add the
   column and backfill in batches per conversation range (`backfillMessageSequence`
   in `db/migrations/016_message_sync.ts` is idempotent: it only touches rows
   without a number), build `messages_conversation_seq_idx` with
   `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS`, then let the migration
   run (its statements are `IF NOT EXISTS` / `OR REPLACE` and become cheap).

Roll back only after the clients have been rolled back or are known to
tolerate a 404 on `/api/message/sync` (they do): `down` drops both triggers,
both functions, `message_deletions`, the indexes and the columns.

## A conversation keeps resyncing (`resyncRequired` on every `/api/message/sync`)

A client that reloads the newest page on every reconnect is being told its
cursor cannot be continued. Check the conversation:

```sql
select id, last_seq, tombstone_floor_seq from conversations where pair_key = '<idA>:<idB>';
```

- The client's `conversationId` differs from `id`: the thread was deleted and
  started again; the client should adopt the new id after its reload. If it
  does not, the client build is at fault.
- The client's cursor is below `tombstone_floor_seq`: it was offline longer
  than tombstone retention (30 days). One reload is expected; repeated ones
  mean the client is not storing the cursor from the reloaded page.
- The cursor is above `last_seq`: the client carries a cursor from another
  conversation or from before a restore. One reload fixes it.

Sync never marks anything read, so a resync loop costs reads, not data.

## Media URL unresolvable (`motionmeet_media_url_unresolvable_total` rising)

A medium of ours had no object key and none could be read from its stored
URL, so clients got "unavailable" instead of an image.

1. `pnpm --filter @motionmeet/backend backfill:media-keys --dry-run` lists the
   rows by id (never the URLs). Run it without `--dry-run` to write every key
   that can be recovered.
2. What remains has a stored URL that does not contain
   `<purpose>/<userId>/<file>`. Look up the object in S3 by hand; if it
   exists, set the key column (`post_media.object_key`, `stories.media_key`,
   `messages.media_key`, `users.profile_picture_key` / `cover_photo_key`); if it
   does not, the media is gone and "unavailable" is correct.

## Media access hardening (Ek B-1, B-2)

Do this only after the private media rollout steps 1-3 (DEPLOYMENT.md).

1. Find the bucket behind `AWS_BUCKET_NAME` and read its policy and
   Block Public Access settings. If user media and exercise artwork share it,
   apply `infra/s3/user-media-bucket-policy.example.json` (public read for
   `exercises/*` only); better, move user media to a bucket of its own.
2. Verify from outside: `curl -I https://<bucket>.s3.<region>.amazonaws.com/posts/<known-key>`
   must answer 403; the same for `stories/`, `messages/`, `profiles/`, `covers/`.
3. In ImageKit, connect the origin with an IAM user that may only
   `s3:GetObject` on those prefixes.
4. Turn on "Restrict unsigned URLs" for images and videos. Verify: an
   unsigned URL → 401, a signed one → 200, a signed one after its `ik-t` → 401.

## Media metadata missing or failing (`motionmeet_media_metadata_total{result="transient_failure"}` rising)

- `result="transient_failure"` keeps growing and `media-metadata` events reach
  `.dead`: check the worker's readiness (`videoProbe: "unavailable"` means the
  worker runs without ffprobe - deploy it from the `media-runtime` image) and
  S3 reachability from the worker. Fix, then redrive (`outbox:redrive`).
- `result="permanent_failure"`: files ffprobe/sharp cannot read; nothing to
  retry.
- Posts that got no metadata before this was fixed (any failure used to be
  recorded as done): `pnpm --filter @motionmeet/backend backfill:media-metadata --dry-run`,
  then without `--dry-run`. It queues one `media.uploaded` per affected post;
  the consumer fills only what is still missing.

## Restore drill

Not automated here. Restore the latest PITR snapshot into a scratch instance,
run `node dist/scripts/migrate.js` against it (must be a no-op), and compare
row counts of `users`, `posts`, `messages` with production.
