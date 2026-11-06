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

## Restore drill

Not automated here. Restore the latest PITR snapshot into a scratch instance,
run `node dist/scripts/migrate.js` against it (must be a no-op), and compare
row counts of `users`, `posts`, `messages` with production.
