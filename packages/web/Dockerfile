FROM node:22-alpine AS builder
# Set working directory
WORKDIR /app
# Install globally needed tools
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
RUN npm install -g turbo
COPY . .
# Prune the workspace for just the web dependencies
RUN turbo prune @motionmeet/web --docker

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

ARG VITE_BASEURL
ARG VITE_SOCKET_URL

ENV VITE_BASEURL=$VITE_BASEURL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

# Using turbo to run any necessary build scripts in dependencies
RUN pnpm turbo run build --filter=@motionmeet/web

# Nginx image for serving the web app
FROM nginx:alpine AS runner

# Remove default nginx static resources
RUN rm -rf /usr/share/nginx/html/*

# Copy built files from the installer stage
COPY --from=installer /app/packages/web/dist /usr/share/nginx/html

# Copy the nginx config
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
