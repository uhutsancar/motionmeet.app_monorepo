FROM node:22-alpine AS builder
# Set working directory
WORKDIR /app
# Install globally needed tools
RUN npm install -g pnpm turbo

COPY . .
# Prune the workspace for just the backend dependencies
RUN turbo prune @motionmeet/backend --docker

FROM node:22-alpine AS installer
WORKDIR /app
RUN npm install -g pnpm

# First install dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Build the project and its dependencies
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
# Using turbo to run any necessary build scripts in dependencies (e.g. shared)
RUN pnpm turbo run build --filter=@motionmeet/shared

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
