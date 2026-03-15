FROM node:20-alpine

WORKDIR /app

# Copy root and package jsons for workspaces install
COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/web/package.json ./packages/web/
COPY packages/mobile/package.json ./packages/mobile/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies for the entire monorepo
RUN npm install

# Copy all code (overshadowed by volume in dev, but good for base image)
COPY . .

# Expose backend port
EXPOSE 4000

# Start backend using direct npx nodemon for cleaner signals/logs
CMD ["npx", "nodemon", "-L", "packages/backend/server.js"]
