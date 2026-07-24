FROM node:22-alpine

RUN apk add --no-cache bash git
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/web/package.json ./packages/web/package.json
COPY packages/mobile/package.json ./packages/mobile/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter @motionmeet/mobile...

COPY packages/mobile ./packages/mobile
COPY packages/shared ./packages/shared

WORKDIR /app/packages/mobile
EXPOSE 8081
CMD ["pnpm", "start", "--port", "8081", "--lan"]
