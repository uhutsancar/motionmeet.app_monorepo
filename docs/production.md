# Production deployment checklist

## Required before first release

- Use Node.js 22.22+ locally/CI; container images use Node 24.
- Copy `.env.production.example` to an untracked `.env.production`.
- Generate a unique `JWT_SECRET` with at least 32 random bytes.
- Set the exact public HTTPS origin in `FRONTEND_URL` and `CORS_ORIGINS`.
- Use an authenticated MongoDB replica set with automated backups for serious
  workloads, or explicitly accept the single-host bundled database trade-off.
- Configure Redis persistence/monitoring.
- Enable `MEDIA_UPLOADS_ENABLED` only after S3 and ImageKit credentials work.
- Enable `EMAIL_ENABLED` only after SMTP delivery and password-reset links work.
- Upload licensed exercise media to HTTPS object storage/CDN.
- Set `MONGODB_DB_NAME` explicitly; the API refuses MongoDB's implicit `test`
  database.
- Run the integrity and workout-metric migrations after a backup.

Canonical muscle groups, equipment, and the free plan are bootstrapped
idempotently when the API starts. This does not seed exercise media or overwrite
existing administrator changes.

## Release gates

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm audit --prod
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
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
- Back up MongoDB and test restores; named Docker volumes are not backups.
- Run one scheduled-job leader or rely on the Redis lock when horizontally
  scaling the API.
- Rotate JWT, object-store, ImageKit and SMTP credentials on a documented
  schedule.
- Keep `.env.production`, database data and exports out of source control.
- Native Expo apps require separately signed iOS/Android release artifacts;
  they are not part of the server Compose runtime.
