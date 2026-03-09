FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/web/package.json ./packages/web/
COPY packages/mobile/package.json ./packages/mobile/
COPY packages/shared/package.json ./packages/shared/

RUN npm install

COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start Vite dev server
CMD ["npm", "--workspace=client", "run", "dev"]
