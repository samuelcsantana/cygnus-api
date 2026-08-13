FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# ---- Install all dependencies (needed to run the TypeScript build) ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build the application ----
FROM deps AS build
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json tsconfig.seed.json ./
COPY src ./src
RUN npm run build

# ---- Install production-only dependencies ----
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate

# ---- Runtime image ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-seed ./dist-seed
COPY package.json ./

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist-seed/prisma/seed.js && node dist/main.js"]
