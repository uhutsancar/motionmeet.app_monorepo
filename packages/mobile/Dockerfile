FROM node:20-alpine

# Bash might be needed by some Expo scripts
RUN apk add --no-cache bash

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/web/package.json ./packages/web/
COPY packages/mobile/package.json ./packages/mobile/
COPY packages/shared/package.json ./packages/shared/

RUN npm install

COPY . .

# Expose Expo ports
EXPOSE 8081
EXPOSE 19000
EXPOSE 19001
EXPOSE 19002

# Start expo
CMD ["npm", "--workspace=mobile", "run", "start"]
