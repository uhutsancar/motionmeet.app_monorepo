FROM node:24-alpine AS dependencies

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile --prod --filter @motionmeet/backend...

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache tini

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=dependencies --chown=node:node /app/packages/backend/node_modules ./packages/backend/node_modules
COPY --chown=node:node packages/backend ./packages/backend
COPY --chown=node:node packages/shared ./packages/shared

USER node
WORKDIR /app/packages/backend
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
