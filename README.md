# MotionMeet

MotionMeet is a social fitness monorepo:

- `packages/backend`: Express 5, MongoDB/Mongoose, Redis, Socket.IO
- `packages/web`: React, Vite, MUI
- `packages/mobile`: React Native and Expo
- `packages/shared`: shared API routes and media URL helpers

## Local prerequisites

- Node.js 22.22 or newer
- Corepack/pnpm 11.10
- Docker Desktop for the container workflow

## Install and validate

```bash
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

The test task currently runs the backend's validation, token, pagination,
media-signature and workout-metric suites. Web and mobile are additionally
checked by ESLint, TypeScript, and production export/build. Run the visual
browser smoke matrix in CI or from a session with an attached browser.

## Development without Docker

Copy the package examples to untracked local environment files:

```text
packages/backend/.env.example -> packages/backend/.env
packages/web/.env.example     -> packages/web/.env
packages/mobile/.env.example  -> packages/mobile/.env
```

Then run all packages or one package:

```bash
corepack pnpm dev
corepack pnpm dev:backend
corepack pnpm dev:web
corepack pnpm dev:mobile
```

Defaults are API `4000`, web `5173`, and Expo/Metro `8081`.

## Docker development

The development Compose stack contains a MongoDB single-node replica set
(required by workout transactions), Redis, the API, and Vite with bind-mounted
source and hot reload:

```bash
docker compose up --build
```

Optional Expo/Metro container:

```bash
docker compose --profile mobile up --build
```

Copy `.env.development.example` to `.env` only when host-port or Expo origin
overrides are needed. A physical device must use LAN-accessible
`EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_URL` values.

## Docker production

1. Copy `.env.production.example` to `.env.production`.
2. Replace `JWT_SECRET`, `FRONTEND_URL`, and `CORS_ORIGINS`.
3. Enable media/email only after their credentials are supplied.
4. Validate and start:

```bash
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

The production stack serves the SPA and reverse-proxies `/api`, `/health`, and
Socket.IO from one origin. The API and web containers are read-only and
drop Linux capabilities. MongoDB and Redis are on an internal network and are
not published on the host.

The included MongoDB service is suitable for a single-host deployment. For
serious production workloads, supply `MONGODB_URL` for an authenticated managed
replica set with backups and multi-zone failover. Put the web container behind
an HTTPS reverse proxy or load balancer; `FRONTEND_URL` and `CORS_ORIGINS` must
use that exact HTTPS origin.

Native iOS/Android binaries are not server containers. Build them with the Expo
native/EAS workflow using production HTTPS values.

See [docs/production.md](docs/production.md) for the deployment checklist and
[docs/openapi.yaml](docs/openapi.yaml) for the API contract.

## Data migrations

Both commands are dry-run by default:

```bash
corepack pnpm --filter @motionmeet/backend migrate:database-namespace
corepack pnpm --filter @motionmeet/backend migrate:integrity
corepack pnpm --filter @motionmeet/backend migrate:workout-metrics
```

After reviewing the output and taking a database backup:

```bash
corepack pnpm --filter @motionmeet/backend migrate:database-namespace:apply
corepack pnpm --filter @motionmeet/backend migrate:integrity:apply
corepack pnpm --filter @motionmeet/backend migrate:workout-metrics:apply
```

The namespace migration safely merges legacy data from the implicit `test`
database into `MONGODB_DB_NAME` and leaves the source database intact. Run it
before changing an existing deployment from an unnamed MongoDB database.

## Exercise media

The local `exercises-dataset-main` snapshot is excluded from Git and Docker.
It must never be exposed through a filesystem route. Production clients accept
only public HTTP(S) media URLs; licensed media must be migrated to object storage
or a CDN. See [docs/exercises-dataset.md](docs/exercises-dataset.md).
