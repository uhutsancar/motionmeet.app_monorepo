FROM node:22-alpine AS builder
# Set working directory
WORKDIR /app
# Install globally needed tools
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
RUN npm install -g turbo
COPY . .
# Prune the workspace for just the backend dependencies
RUN turbo prune @motionmeet/backend --docker

FROM node:22-alpine AS installer
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

# First install dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Build the project and its dependencies
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
# Removed shared package build

FROM node:22-alpine AS runner
WORKDIR /app

# Add a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 backend
USER backend

# Copy only the necessary files
COPY --from=installer /app .

WORKDIR /app/packages/backend
EXPOSE 8080

CMD ["node", "server.js"]
