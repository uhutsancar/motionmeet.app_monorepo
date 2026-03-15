FROM node:20-alpine

# Bash and other tools might be needed by some Expo scripts or underlying libs
RUN apk add --no-cache bash git

WORKDIR /app

# Copy root and package jsons for workspaces install
COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/web/package.json ./packages/web/
COPY packages/mobile/package.json ./packages/mobile/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies for the entire monorepo with legacy-peer-deps for stability
RUN npm install --legacy-peer-deps

# Copy all code (overshadowed by volume in dev, but good for base image stability)
COPY . .

# Expose typical Expo/Metro ports
EXPOSE 8081
EXPOSE 19000
EXPOSE 19001
EXPOSE 19002

# Switch to the mobile package directory to ensure Metro resolves paths (like App.js) correctly
WORKDIR /app/packages/mobile

# Start expo metro bundler on all interfaces
CMD ["npx", "expo", "start", "--port", "8081", "--dev-client"]
