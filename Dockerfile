FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY tsconfig.json ./
COPY vitest.config.ts ./
COPY src ./src
COPY test ./test

USER node

CMD ["npm", "test"]