# MotionMeet

**A social network for people who train.** Log workouts, build routines, track
progress — and share it with the people you train with: posts, stories,
direct messages and nearby athletes.

[![CI](https://github.com/uhutsancar/motionmeet.app_monorepo/actions/workflows/ci.yml/badge.svg)](https://github.com/uhutsancar/motionmeet.app_monorepo/actions/workflows/ci.yml)

MotionMeet is a TypeScript monorepo with an Express/PostgreSQL backend, a React
web app and a React Native (Expo) mobile app that share one contract package.

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Testing and quality gates](#testing-and-quality-gates)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Security](#security)
- [Licensing and data attribution](#licensing-and-data-attribution)

## Features

**Training**
- Workout logging with sets, reps and weight; routines and folders
- Exercise library with muscle groups, equipment and instructions; custom exercises
- Statistics, personal records and per-exercise history
- Body measurements
- Shareable workout cards (rendered on the server as PNG)

**Social**
- Posts with text, photos, video or an attached workout; likes and comments
- Stories with movable text overlays, viewers and reactions (24-hour lifetime)
- Following with follow requests and private accounts; mutual connections
- Real-time direct messages with typing indicators, read receipts and catch-up
  after reconnecting
- Activity notifications
- Explore grid and people search
- Nearby athletes by distance band — exact coordinates are never returned

**Account and privacy**
- Per-post visibility (public, followers, private) and profile privacy settings
- Data export and permanent account deletion
- Turkish and English, light and dark themes

There are no paid tiers or in-app purchases. The mobile app has ad placements
wired to Google's test ad units only.

## Architecture

One backend codebase, built into one image and run as separate processes:

```
   Web (React, static)            Mobile (Expo / React Native)
            │   HTTPS / WSS               │
            └───────────────┬─────────────┘
                     Nginx (web container)
                            │
              ┌─────────────┴──────────────┐
              │  api      Express + Socket.IO │──── Redis (cache, rate limits,
              └─────────────┬──────────────┘          Socket.IO adapter)
                            │
                   PostgreSQL 18 (source of truth)
                   domain rows + transactional outbox
                            │
          ┌─────────────────┴──────────────────┐
          │ worker     outbox relay, consumers  │──── RabbitMQ (optional transport)
          │ scheduler  housekeeping             │
          └────────────────────────────────────┘
          S3 (media originals) · ImageKit (transformed delivery)
```

- **PostgreSQL is the source of truth.** A change and the event announcing it
  are written in one transaction (transactional outbox); events are delivered
  afterwards, in-process or through RabbitMQ with publisher confirms, and every
  consumer is idempotent.
- **Uploads go straight to object storage.** Clients upload with presigned URLs;
  the API verifies owner, size, stored type and the file's own signature before
  attaching it; a media worker adds image and video metadata later.
- **Privacy is enforced on every read.** Caches are invalidated when access
  narrows, sockets are bound to their login session, and an automated
  authorization sweep checks every resource type.
- **Background work runs outside the API.** The scheduler holds a PostgreSQL
  advisory lock per task; the worker drains the outbox continuously.

The full picture, with the reasoning behind each choice, is in
[docs/architecture](docs/architecture/TARGET_ARCHITECTURE.md) and its
[ADRs](docs/architecture/adr).

## Tech stack

| Area | Technology |
|---|---|
| Backend | Node.js 22/24, Express 5, Socket.IO 4, Kysely, PostgreSQL 18, Redis, RabbitMQ (`amqplib`), `sharp`, FFmpeg (worker only), `prom-client` |
| Web | React 19, Vite 7, React Router, MUI 7, Redux Toolkit, i18next |
| Mobile | Expo SDK 58, React Native 0.88, React Navigation 7, React Native Paper, `expo-image`, `expo-video` |
| Shared | TypeScript contracts, route constants, share-card rendering |
| Tooling | pnpm workspaces, Turborepo, strict TypeScript, ESLint 9, Node test runner, Docker Compose, GitHub Actions, k6 |

## Repository layout

```
packages/
  backend/    API, worker and scheduler (entrypoints/), outbox and broker
              (messaging/), migrations (db/), observability, tests
  web/        React web app and its Nginx configuration
  mobile/     Expo app
  shared/     Contracts and utilities used by all three
tools/
  database-migration/   offline legacy-data import (never shipped with the API)
infra/grafana/          importable Grafana dashboard
scripts/                security gates, brand assets, load-test tooling
docs/                   architecture, operations, quality, API contract
```

## Getting started

### Prerequisites

- Node.js **22.23.4+** (22 line) or **24.22.1+** (24 line) — `corepack pnpm
  security:node` checks the binary on your PATH
- Corepack with pnpm 11.10
- Docker Desktop, or local PostgreSQL 18 and Redis

### Install

```bash
corepack enable
corepack pnpm install --frozen-lockfile
```

### Configure

Copy the examples to untracked files and fill them in:

```text
packages/backend/.env.example -> packages/backend/.env
packages/web/.env.example     -> packages/web/.env
packages/mobile/.env.example  -> packages/mobile/.env
```

The backend needs `DATABASE_URL`, `REDIS_URL` and `JWT_SECRET`. Media uploads
and email stay off until their flags and credentials are set. Every variable is
described in [`packages/backend/.env.example`](packages/backend/.env.example).

### Run locally

```bash
corepack pnpm dev            # backend, web and mobile together
corepack pnpm dev:backend    # API on :4000 (runs migrations on start)
corepack pnpm dev:web        # Vite on :5173
corepack pnpm dev:mobile     # Expo / Metro on :8081
```

In local development the API also runs the housekeeping tasks and delivers
outbox events itself, so nothing else is needed. To run the worker and
scheduler as separate processes: `pnpm --filter @motionmeet/backend worker`
and `... scheduler`.

**Physical device on the same network:** `corepack pnpm dev:local` detects the
active network adapter and wires API, web, Metro and CORS origins to it
(`corepack pnpm local:ip` shows the address; `MOTIONMEET_LAN_IP` overrides it).

### Run with Docker

```bash
docker compose up --build --wait                                   # PostgreSQL, Redis, API, web
docker compose --profile queue --profile workers up --build        # + RabbitMQ, worker, scheduler
docker compose --profile mobile up --build                         # + Expo
```

### Reference data

Profile locations search a countries/regions/cities dataset kept in PostgreSQL.
Import it once after migrating:

```bash
corepack pnpm --filter @motionmeet/backend run import:locations
```

Proximity search uses PostGIS when available and an indexed bounding box
otherwise; the schema is the same either way.

## Testing and quality gates

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test           # unit tests in every package
corepack pnpm build
```

Backend integration tests run against disposable containers (the test database
name must end in `_test`):

```bash
docker compose -f docker-compose.test.yml up -d --wait postgres-test rabbitmq-test redis-test
export DATABASE_URL=postgresql://postgres:motionmeet-test@127.0.0.1:5433/motionmeet_test \
  RABBITMQ_URL=amqp://motionmeet:motionmeet-test@127.0.0.1:5673 \
  REDIS_URL=redis://127.0.0.1:6381
corepack pnpm --filter @motionmeet/backend migrate:postgres
corepack pnpm --filter @motionmeet/backend test:integration
docker compose -f docker-compose.test.yml down --remove-orphans
```

An end-to-end authorization sweep checks that one member can never read, change
or delete another member's resources. Run it against a disposable stack only:

```bash
E2E_BASE_URL=http://localhost:8088 corepack pnpm --filter @motionmeet/backend test:e2e
```

Security gates, also enforced in CI:

```bash
corepack pnpm security:node    # patched Node.js in the toolchain, Dockerfiles and CI
corepack pnpm security:audit   # dependency advisories (high/critical fail the build)
corepack pnpm test:scripts     # tests for the gates themselves
```

Load-test tooling (synthetic data, query plans, k6) is in
[`scripts/load`](scripts/load); results are recorded in
[PERFORMANCE_BASELINE.md](docs/quality/PERFORMANCE_BASELINE.md).

CI ([`ci.yml`](.github/workflows/ci.yml)) runs on every push to `main` and every
pull request: security gates, lint and typecheck, unit tests on Node 22 and 24,
integration tests against PostgreSQL, RabbitMQ and Redis, web and mobile
builds with their size budgets, and production image builds. The authorization
sweep and load tests need a running stack and are run by hand.

## Deployment

`docker-compose.prod.yml` runs the production topology from one backend image:
a one-shot `migrate` job, the `backend` API, the `worker`, the `scheduler` and
the `web` Nginx container — read-only filesystems, non-root users, all Linux
capabilities dropped. PostgreSQL, Redis and RabbitMQ are expected as managed,
authenticated, TLS-enabled services.

```bash
cp .env.production.example .env.production   # then fill it in
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml up -d --build
```

To rehearse the full topology on one machine with bundled data services:

```bash
MOTIONMEET_ENV_FILE=.env.production.example \
  docker compose -f docker-compose.prod.yml -f docker-compose.local.yml up -d --build
# http://localhost:8088
```

Mobile binaries are built and signed separately (Expo / EAS). Release
checklists, environment variables and runbooks:
[DEPLOYMENT.md](docs/operations/DEPLOYMENT.md),
[production.md](docs/production.md),
[RUNBOOKS.md](docs/operations/RUNBOOKS.md).

## Documentation

| Topic | Where |
|---|---|
| Architecture and decisions | [TARGET_ARCHITECTURE.md](docs/architecture/TARGET_ARCHITECTURE.md), [ADRs](docs/architecture/adr), [EVENT_CATALOG.md](docs/architecture/EVENT_CATALOG.md) |
| Current state of the architecture work | [IMPLEMENTATION_STATUS.md](docs/architecture/IMPLEMENTATION_STATUS.md) |
| Detailed system map (Turkish) | [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) |
| HTTP API contract | [openapi.yaml](docs/openapi.yaml) |
| Database rules and migrations | [database.md](docs/database.md) |
| Operations | [DEPLOYMENT.md](docs/operations/DEPLOYMENT.md), [RUNBOOKS.md](docs/operations/RUNBOOKS.md), [observability.md](docs/architecture/observability.md) |
| Quality | [TEST_MATRIX.md](docs/quality/TEST_MATRIX.md), [PERFORMANCE_BASELINE.md](docs/quality/PERFORMANCE_BASELINE.md) |
| Security | [SECURITY_THREAT_MODEL.md](docs/architecture/SECURITY_THREAT_MODEL.md) |
| Mobile release on a device | [mobile-qa-apk.md](docs/mobile-qa-apk.md) |
| Monitoring dashboard | [infra/grafana](infra/grafana/README.md) |

## Security

- Secrets never belong in this repository: every `.env*` file except the
  `*.example` templates is ignored, and examples contain placeholders only.
- Please report suspected vulnerabilities privately to the maintainer instead of
  opening a public issue.

## Licensing and data attribution

This repository does not include an open-source license; unless one is added,
all rights are reserved by the author.

Bundled reference datasets (exercises, locations) carry their own terms and
attribution requirements — see [LICENSES.md](docs/LICENSES.md).
