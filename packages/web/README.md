# MotionMeet Web

React 19 and Vite client for MotionMeet. Material UI provides the application theme and primary component system; Recharts remains the chart renderer. Tailwind is retained only for legacy layouts that have not yet been replaced cleanly by MUI.

## Environment

Copy `.env.example` to a local environment file and set:

- `VITE_BASEURL`: backend HTTP origin, for example `http://localhost:4000`
- `VITE_SOCKET_URL`: Socket.IO origin; normally the same backend origin
- `VITE_BUILD_SOURCEMAP=true`: optional production source maps

Do not commit environment files.

## Commands

Run from the repository root:

```bash
corepack pnpm --filter @motionmeet/web dev
corepack pnpm --filter @motionmeet/web lint
corepack pnpm --filter @motionmeet/web typecheck
corepack pnpm --filter @motionmeet/web build
```

The Vite development server listens on port `5173`.

