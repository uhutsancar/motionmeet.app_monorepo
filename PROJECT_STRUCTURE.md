# Project structure

```text
motionmeet.app_monorepo/
├── packages/
│   ├── backend/       Express 5, MongoDB, Clerk, Inngest, Socket.IO
│   ├── web/           React 19, Vite, MUI, Recharts
│   └── mobile/        Expo 54, React Native Paper, react-native-chart-kit
├── docs/              Architecture and operational decisions
├── docker-compose.yml Development containers
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json
├── tsconfig.json
└── package.json
```

The three applications are independent workspace packages named `@motionmeet/backend`, `@motionmeet/web`, and `@motionmeet/mobile`. They do not import each other's source code.

The former `packages/shared` package was removed because it exported only empty objects and had no consumers. Platform-neutral code should be extracted only after two applications have a real, matching use case.

Root scripts are backed by Turborepo:

- `pnpm dev` runs persistent development tasks without cache.
- `pnpm build` builds the web and Expo web outputs and checks backend JavaScript.
- `pnpm lint` runs package lint scripts that exist.
- `pnpm typecheck` runs package type checks.

Build outputs are cached per application: `packages/web/dist` and `packages/mobile/.expo`; backend has no emitted build artifact.

