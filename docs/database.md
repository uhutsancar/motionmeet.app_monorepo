# Database architecture and operations

## Sources of truth

MongoDB references are application-managed relationships. Mongoose `ref` and
`populate` do not create foreign keys or cascades.

| Data | Source of truth | Derived/materialized data |
| --- | --- | --- |
| Follow | `userfollows` unique edge | User follower/following counters |
| Connection | `connections.pairKey` unique edge | User connection counter |
| Post interaction | `postlikes`, `postcomments` | Post counters |
| Direct messages | `conversations.pairKey`, `messages.conversationId` | Conversation unread and last-message state |
| Workout history | `workouts` | Daily stats, exercise stats, personal records |
| Story expiry | `stories.expiresAt` | Durable media deletion jobs |

Counters are updated in the same MongoDB transaction as their source edge.
Redis is a cache, rate-limit and coordination layer; it is never the durable
source for a MongoDB counter.

## Embedding and references

- Workout and routine sets stay embedded because they are bounded and normally
  read with their parent. Models enforce 50 exercises and 30 sets per exercise.
- Each workout/routine exercise also stores an immutable name, muscle group and
  equipment snapshot so historical analytics do not depend on mutable exercise
  master data.
- Unbounded many-to-many data (follows, connections, likes, comments and
  messages) stays in separate collections with compound indexes.
- Post author profile fields are an extended reference. Profile changes write a
  durable outbox event in the same transaction as the User update.
- Upload reservations are consumed in the same transaction as the referencing
  Post, Story, Message or User update. Deletions are first committed to a
  durable media-job collection, so a process crash cannot orphan the DB/S3
  lifecycle.

## Required deployment sequence

Take a tested backup and stop API writers before applying migrations. The
analytics rebuild resets and recomputes materialized collections, so running it
beside live workout writes can double-count or lose a concurrent update.

```bash
corepack pnpm --filter @motionmeet/backend migrate:database-namespace
corepack pnpm --filter @motionmeet/backend migrate:database-namespace:apply

corepack pnpm --filter @motionmeet/backend migrate:integrity
corepack pnpm --filter @motionmeet/backend migrate:integrity:apply

corepack pnpm --filter @motionmeet/backend migrate:workout-metrics
corepack pnpm --filter @motionmeet/backend migrate:workout-metrics:apply

corepack pnpm --filter @motionmeet/backend migrate:indexes:verify
```

The integrity migration:

- refuses to build unique indexes when unsafe duplicates exist;
- reports self-edges and orphaned application references before changing data;
- merges reverse/duplicate connection edges;
- rebuilds conversations from messages and backfills `conversationId`;
- reconciles social and post counters from their source collections;
- removes the unsafe Story TTL index;
- synchronizes every declared model index;
- installs critical MongoDB `$jsonSchema` validators.

Production startup fails closed when the required migration checksum or index
contract is missing.

## Query and capacity rules

- List endpoints use cursor pagination. Offset pagination for exercises remains
  temporarily compatible but is capped at 5,000 rows.
- Exercise prefix search uses normalized indexed names.
- The following feed uses bounded `$in` fan-in for up to 2,000 sources, then
  switches to indexed edge lookups to avoid building very large application
  arrays.
- Workout charts and personal records read computed collections instead of
  unwinding the complete Workout history on every request.
- Exact index choices must be checked against production-shaped data with
  `explain("executionStats")`. Watch examined/returned ratios and blocking
  sorts rather than adding speculative indexes.

## Production topology

Production requires:

- an authenticated, TLS-enabled replica set with at least three data-bearing
  members across failure domains;
- point-in-time backups and regular restore tests;
- authenticated TLS Redis with HA/failover;
- a connection budget calculated across every API/worker instance.

`docker-compose.prod.yml` intentionally contains no single-node database. The
API validates database credentials, replica-set settings and transport
security. Pool sizes and wait timeouts are controlled by the `MONGODB_*`
settings in `packages/backend/.env.example`.

Do not shard first. Fix schema, indexes, queries and vertical capacity before
sharding. If sharding becomes necessary, choose keys from measured query
patterns:

- messages: `conversationId` plus time;
- workouts/analytics: user identity plus time;
- social edges: inbound and outbound access may require separate materialized
  projections because one shard key cannot target both directions.

## Failure and reconciliation drills

Exercise these cases in staging:

1. Concurrent first messages for the same pair create one Conversation.
2. Twenty retries of the same like/workout operation produce one edge/entity.
3. MongoDB failure during a transaction leaves no Redis-only counter change.
4. Expired Story deletion leaves a durable media deletion job.
5. Committing an uploaded object consumes its reservation in the entity
   transaction; deleting a Post creates a durable media job.
6. Deleting the latest message advances Conversation to the previous message.
7. Account deletion removes conversations, owned Story views and interaction
   counts.
8. Re-running every migration is safe and reports no missing indexes.

The integration test uses a real MongoDB replica set:

```bash
docker compose -f docker-compose.test.yml up -d --wait
MONGODB_TEST_URL='mongodb://127.0.0.1:27018/?replicaSet=rsTest' \
  corepack pnpm --filter @motionmeet/backend test:integration
docker compose -f docker-compose.test.yml down
```
