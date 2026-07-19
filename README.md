# MotionMeet

MotionMeet is a social fitness platform with an Express/MongoDB backend, a React/Vite web client, and a React Native/Expo mobile client.

## Requirements

- Node.js 20.19 or newer
- pnpm 11.10.0 (managed through Corepack)
- MongoDB and Clerk credentials for authenticated backend flows

## Install

```bash
corepack enable
corepack pnpm install --frozen-lockfile
```

Keep credentials in local `.env` files. Do not commit them. The backend example is `packages/backend/.env.example`; web variables use the `VITE_` prefix and mobile variables use `EXPO_PUBLIC_`.

Required client variables:

- Web: `VITE_BASEURL`, `VITE_SOCKET_URL`, `VITE_CLERK_PUBLISHABLE_KEY`
- Mobile: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`

## Development

Run every application through Turborepo:

```bash
corepack pnpm dev
```

Or run one application:

```bash
corepack pnpm dev:backend
corepack pnpm dev:web
corepack pnpm dev:mobile
```

The default ports are backend `4000`, web `5173`, and Expo/Metro `8081`.

## Validation

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
```

There is no automated test suite in the repository yet, so no placeholder `test` task is defined.

## Docker development

```bash
docker compose up --build
```

For a physical mobile device, set `EXPO_PUBLIC_API_URL` to an address the device can reach and, when Expo cannot infer the host, set `REACT_NATIVE_PACKAGER_HOSTNAME` in your shell or a local Compose override. Never commit a machine-specific LAN IP.

The backend requires a long-running Node host because it serves Socket.IO connections. The web SPA can be deployed separately using `packages/web/vercel.json` when Vercel's project root is `packages/web`.

## Exercise dataset

The local `exercises-dataset-main` snapshot is intentionally excluded from Git and Docker builds. Its media license is not transferable to this project, so it must not be shipped until MotionMeet has a suitable license. See [docs/exercises-dataset.md](docs/exercises-dataset.md).

