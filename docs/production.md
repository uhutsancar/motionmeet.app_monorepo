# Production deployment checklist

## Required before first release

- Use Node.js 22.22+ locally/CI; container images use Node 24.
- Copy `.env.production.example` to an untracked `.env.production`.
- Generate a unique `JWT_SECRET` with at least 32 random bytes.
- Set the exact public HTTPS origin in `FRONTEND_URL` and `CORS_ORIGINS`.
- Use an authenticated, TLS-enabled, multi-zone MongoDB replica set with
  automated point-in-time backups. Production Compose does not bundle a
  single-node database.
- Use authenticated TLS Redis with persistence, monitoring and failover.
- Enable `MEDIA_UPLOADS_ENABLED` only after S3 and ImageKit credentials work.
- Enable `EMAIL_ENABLED` only after SMTP delivery and password-reset links work.
- Upload licensed exercise media to HTTPS object storage/CDN.
- Set `MONGODB_DB_NAME` explicitly; the API refuses MongoDB's implicit `test`
  database.
- Pause API writers and run the integrity/workout-metric migrations after a
  backup.
- Verify the index contract before starting production API instances.
- Register the initial administrator as a normal user, then explicitly promote
  that exact username with `admin:promote`; public registration never elevates
  roles from an email address.

Canonical muscle groups, equipment, and the free plan are bootstrapped
idempotently when the API starts. This does not seed exercise media or overwrite
existing administrator changes.

```bash
corepack pnpm --filter @motionmeet/backend admin:promote <username> --confirm
```

## Release gates

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm audit --prod
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
docker compose -f docker-compose.test.yml up -d --wait mongo-test
docker compose -f docker-compose.test.yml run --rm mongo-test-init
MONGODB_TEST_URL='mongodb://127.0.0.1:27018/?replicaSet=rsTest' corepack pnpm --filter @motionmeet/backend test:integration
docker compose -f docker-compose.test.yml down
corepack pnpm build
docker compose config
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml build
```

After deployment:

```bash
curl --fail https://app.example.com/health/live
curl --fail https://app.example.com/health/ready
```

Smoke-test registration/login/logout, password reset, workout creation,
statistics, feed visibility, follow/connect, messages, media upload, data export
and account deletion using non-production test accounts.

## Operations

- Terminate TLS before the web container and preserve the public host/protocol.
- Alert on `/health/ready`, 5xx rate, latency, MongoDB/Redis health and disk use.
- Alert on Mongo pool checkout failures/wait time, transaction retries,
  write-conflicts, slow-query examined/returned ratio, outbox lag, media-job
  backlog and counter reconciliation drift.
- Back up MongoDB and test restores; named Docker volumes are not backups.
- Story and abandoned-upload scans use Redis leases. Outbox and media workers
  use atomic MongoDB claim leases and can run on multiple instances.
- Rotate JWT, object-store, ImageKit and SMTP credentials on a documented
  schedule.
- Keep `.env.production`, database data and exports out of source control.
- Native Expo apps require separately signed iOS/Android release artifacts;
  they are not part of the server Compose runtime.

See [database.md](database.md) for source-of-truth rules, migrations, query
capacity and sharding guidance.
