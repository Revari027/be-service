# Multi-stage build for the inventory-backend service.
# The dependencies stage keeps the build toolchain (native bcrypt) and the
# Prisma CLI, the production stage only ships what is needed at runtime.

FROM node:22-alpine AS dependencies
WORKDIR /app

# openssl is required by the Prisma engines, the apk toolchain is required to
# compile the native bcrypt module on alpine.
RUN apk add --no-cache openssl python3 make g++

COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Prisma engines link against libssl at runtime.
RUN apk add --no-cache openssl

COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma
COPY src ./src

# Prisma Client is generated inside the image so the runtime never needs the
# schema at request time. Generate it before dropping privileges.
RUN npx prisma generate && chown -R node:node /app

USER node
EXPOSE 5000

CMD ["node", "src/server.js"]
