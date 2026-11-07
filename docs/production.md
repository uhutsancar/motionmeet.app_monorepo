# Production deployment checklist

## Required before first release

- Use Node.js 22.23.4+ or 24.22.1+ locally and in CI; container images use
  `node:24.22.1-alpine` pinned by digest. `corepack pnpm security:node` and the
  CI `docker-production` job verify the runtime actually in the image.
- Copy `.env.production.example` to an untracked `.env.production`.
- Generate a unique `JWT_SECRET` with at least 32 random bytes.
- Set the exact public HTTPS origin in `FRONTEND_URL` and `CORS_ORIGINS`.
- Set `TRUST_PROXY` to the proxies in front of the API (required; see
  "Client addresses" in [operations/DEPLOYMENT.md](operations/DEPLOYMENT.md)).
- Use authenticated, TLS-enabled, multi-zone managed PostgreSQL with automated
  point-in-time backups and tested restores.
- Size `DATABASE_POOL_MAX` across all API, worker and scheduler replicas
  (budget in [operations/DEPLOYMENT.md](operations/DEPLOYMENT.md)).
- Use authenticated TLS Redis with monitoring and failover; with more than one
  API replica set `READINESS_REQUIRE_REDIS=true`.
- Choose the outbox transport: `OUTBOX_TRANSPORT=direct` (no broker) or
  `rabbitmq` with an `amqps://` `RABBITMQ_URL` on a dedicated vhost/user.
- Enable media or email only after S3/ImageKit or SMTP credentials are tested.
- Migrations run as the one-shot `migrate` service before the other services
  start (`RUN_MIGRATIONS=false` on the API). On a large `posts` table, build
  migration 015's index `CONCURRENTLY` by hand first (see DEPLOYMENT.md).
- Register the first administrator normally, then promote that exact username
  with the explicit confirmed command below.

```bash
corepack pnpm --filter @motionmeet/backend admin:promote <username> --confirm
```

Canonical muscle groups and equipment are bootstrapped
idempotently and never overwrite administrator changes.

## Release gates

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm audit --prod
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build

docker compose -f docker-compose.test.yml up -d --wait postgres-test rabbitmq-test redis-test
export DATABASE_URL='postgresql://postgres:motionmeet-test@127.0.0.1:5433/motionmeet_test' \n  RABBITMQ_URL='amqp://motionmeet:motionmeet-test@127.0.0.1:5673' REDIS_URL='redis://127.0.0.1:6381'
corepack pnpm --filter @motionmeet/backend migrate:postgres
corepack pnpm --filter @motionmeet/backend test:integration
docker compose -f docker-compose.test.yml down

docker compose config
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml build
```

After deployment:

```bash
curl --fail https://app.example.com/health/live
# Readiness reports dependencies and capabilities, so the public proxy
# answers 404 for it; ask each process on its private ops port instead.
docker compose -f docker-compose.prod.yml exec backend \
  node -e "fetch('http://127.0.0.1:9464/health/ready').then(async r=>{console.log(r.status, await r.text());process.exit(r.ok?0:1)})"
```

Smoke-test registration, login/logout, password reset, profile updates,
workouts, statistics, routines, feed visibility, follow/connect, posts,
stories, messages, media upload, data export and account deletion with dedicated
test accounts.

## Operations

- Terminate TLS before the web container and preserve public host/protocol.
- Alert on readiness, 5xx rate, latency, PostgreSQL pool saturation, slow
  queries, Redis state, outbox lag and dead events, and media-deletion backlog
  (metrics and suggested thresholds:
  [architecture/observability.md](architecture/observability.md); responses:
  [operations/RUNBOOKS.md](operations/RUNBOOKS.md)).
- Back up PostgreSQL and test restores; Docker named volumes are not backups.
- Scheduled tasks hold PostgreSQL advisory locks, so any number of scheduler
  replicas is safe. Outbox and media jobs use atomic PostgreSQL claims and may
  run on multiple worker instances.
- Rotate JWT, database, cache, object-store, ImageKit and SMTP credentials.
- Keep environment files, database data, migration exports and secrets out of
  source control.
- Expo release artifacts are signed and distributed separately from server
  Compose.

See [database.md](database.md) for schema, transaction, migration and query
capacity rules.
