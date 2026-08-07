# MotionMeet

MotionMeet is a TypeScript social-fitness monorepo:

- `packages/backend`: Express 5, PostgreSQL/Kysely, Redis, S3 and Socket.IO
- `packages/web`: React 19, Vite and MUI
- `packages/mobile`: React Native and Expo
- `packages/shared`: shared API contracts, domain types and utilities
- `tools/database-migration`: isolated, offline legacy-data import and verification utility

## Prerequisites

- Node.js 22.22 or newer
- Corepack and pnpm 11.10
- PostgreSQL 18 and Redis, or Docker Desktop

## Install and validate

```bash
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

Every application package is strict TypeScript. Backend and shared tests run
through `tsx`; web uses a Vite production build; mobile uses Expo export.

## Development without Docker

Copy the package examples to untracked local environment files:

```text
packages/backend/.env.example -> packages/backend/.env
packages/web/.env.example     -> packages/web/.env
packages/mobile/.env.example  -> packages/mobile/.env
```

The backend requires `DATABASE_URL`, `REDIS_URL` and `JWT_SECRET`. Media and
email capabilities remain disabled unless their explicit enable flags and
credentials are supplied.

```bash
corepack pnpm dev
corepack pnpm dev:backend
corepack pnpm dev:web
corepack pnpm dev:mobile
```

Defaults are API `4000`, web `5173`, PostgreSQL `5432`, Redis `6379`, and
Expo/Metro `8081`.

For LAN development with Expo Go on a physical device, use the local-network
commands. They detect the active physical IPv4 adapter at startup, ignore common
WSL/Hyper-V/VirtualBox/VPN adapters, and inject matching API, web, Metro and CORS
origins without hard-coding the current Wi-Fi address:

```bash
corepack pnpm local:ip
corepack pnpm dev:local

# Or run each service in a separate terminal:
corepack pnpm dev:local:backend
corepack pnpm dev:local:web
corepack pnpm dev:local:mobile
```

The defaults remain API `4000`, web `5173` and Expo `8081`. Set
`MOTIONMEET_LAN_IP` only when automatic adapter selection needs an explicit
override.

## Docker development

The development stack starts PostgreSQL 18, Redis, the API and Vite. Database
and cache health checks gate backend startup; the API applies idempotent Kysely
migrations before accepting traffic.

```bash
docker compose up --build --wait
```

Expo is optional in Compose:

```bash
docker compose --profile mobile up --build
```

A physical device needs LAN-accessible `EXPO_PUBLIC_API_URL` and
`EXPO_PUBLIC_WEB_URL` values.

## Database migrations

Apply the PostgreSQL schema directly with:

```bash
corepack pnpm --filter @motionmeet/backend migrate:postgres
```

Application startup also runs the same idempotent migration set unless
`RUN_MIGRATIONS=false`. Existing installations use the isolated migration tool
under `tools/database-migration`; it is not imported by or shipped with the
production API. See [database operations](docs/database.md).

## Location reference data

The profile-location picker searches country, region and city records held in
PostgreSQL. Import them once after migrating:

```bash
corepack pnpm --filter @motionmeet/backend run import:locations
```

The script downloads a pinned release of the Countries States Cities Database,
keeps only the columns the app reads, and can be re-run to pick up a newer
dataset — records that disappear upstream are deactivated rather than deleted so
saved profile locations survive. Until it runs, location search simply returns
no results.

Proximity search uses PostGIS where the extension is available and falls back to
an indexed bounding box plus haversine where it is not; the schema is identical
either way. The mode is logged at boot as `location_geometry_mode`.

Both bundled datasets carry attribution obligations — see
[LICENSES.md](docs/LICENSES.md) before shipping.

## Docker production

1. Copy `.env.production.example` to `.env.production`.
2. Set managed `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `FRONTEND_URL` and
   `CORS_ORIGINS`.
3. Enable media/email only after their credentials are supplied.
4. Validate, build and start:

```bash
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Production intentionally uses external, authenticated, TLS-enabled PostgreSQL
and Redis services. The backend image runs compiled JavaScript only; the web
image serves static Vite output through unprivileged Nginx. Both containers are
read-only and drop Linux capabilities.

Native iOS/Android binaries are built separately with the Expo/EAS workflow.
See [production.md](docs/production.md) and [the API contract](docs/openapi.yaml).

## Exercise media

Large media remains in S3/CDN storage. PostgreSQL stores only object keys,
public URLs and metadata. See [exercises-dataset.md](docs/exercises-dataset.md).

The exercise animations are Gym visual's property and their redistribution
licence is still open, and is being handled as separate work — read
[LICENSES.md §2b](docs/LICENSES.md) before a public release.
