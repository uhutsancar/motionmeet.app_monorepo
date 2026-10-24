# Production deployment checklist

## Required before first release

- Use Node.js 22.23.4+ or 24.22.1+ locally and in CI; container images use
  `node:24.22.1-alpine` pinned by digest. `corepack pnpm security:node` and the
  CI `docker-production` job verify the runtime actually in the image.
- Copy `.env.production.example` to an untracked `.env.production`.
- Generate a unique `JWT_SECRET` with at least 32 random bytes.
- Set the exact public HTTPS origin in `FRONTEND_URL` and `CORS_ORIGINS`.
- Use authenticated, TLS-enabled, multi-zone managed PostgreSQL with automated
  point-in-time backups and tested restores.
- Size `DATABASE_POOL_MAX` across all API/worker replicas.
- Use authenticated TLS Redis with monitoring and failover.
- Enable media or email only after S3/ImageKit or SMTP credentials are tested.
- Keep `RUN_MIGRATIONS=true` for a controlled first rollout, or run
  `migrate:postgres` as a dedicated release job before starting instances.
- Register the first administrator normally, then promote that exact username
  with the explicit confirmed command below.

```bash
corepack pnpm --filter @motionmeet/backend admin:promote <username> --confirm
```

Canonical muscle groups, equipment and default plans are bootstrapped
idempotently and never overwrite administrator changes.

## Release gates

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm audit --prod
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build

docker compose -f docker-compose.test.yml up -d --wait
DATABASE_URL='postgresql://postgres:motionmeet-test@127.0.0.1:5433/motionmeet_test' corepack pnpm --filter @motionmeet/backend migrate:postgres
DATABASE_URL='postgresql://postgres:motionmeet-test@127.0.0.1:5433/motionmeet_test' corepack pnpm --filter @motionmeet/backend test:integration
docker compose -f docker-compose.test.yml down

docker compose config
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml build
```

After deployment:

```bash
curl --fail https://app.example.com/health/live
curl --fail https://app.example.com/health/ready
```

Smoke-test registration, login/logout, password reset, profile updates,
workouts, statistics, routines, feed visibility, follow/connect, posts,
stories, messages, media upload, data export and account deletion with dedicated
test accounts.

## Operations

- Terminate TLS before the web container and preserve public host/protocol.
- Alert on readiness, 5xx rate, latency, PostgreSQL pool saturation, slow
  queries, Redis state, outbox lag and media-deletion backlog.
- Back up PostgreSQL and test restores; Docker named volumes are not backups.
- Expired-story and abandoned-upload scans use Redis leases. Durable outbox and
  media jobs use atomic PostgreSQL claims and may run on multiple instances.
- Rotate JWT, database, cache, object-store, ImageKit and SMTP credentials.
- Keep environment files, database data, migration exports and secrets out of
  source control.
- Expo release artifacts are signed and distributed separately from server
  Compose.

See [database.md](database.md) for schema, transaction, migration and query
capacity rules.
