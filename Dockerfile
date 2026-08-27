FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# ---- Install all dependencies (needed to run the TypeScript build) ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build the application ----
FROM deps AS build
# Prisma 7 generates the client into src/generated/prisma (see the generator
# block in schema.prisma), not into node_modules. So the source tree has to be
# in place before `prisma generate` runs, and the build has to run after it —
# `tsc` compiles the generated client along with the rest of src/.
# prisma.config.ts is required too: it is where the schema path and datasource
# URL now live, since schema.prisma no longer reads env("DATABASE_URL").
# tsconfig.seed.json compiles the catalog sync into dist-seed because the CMD
# below runs it on every container start. `prisma migrate deploy` adds the
# catalog columns but populates nothing, so the sync is the step that actually
# puts a schedule version in the table — and making it part of the start
# sequence is what keeps a new catalog from needing a manual release action
# that someone has to remember. It is idempotent by construction: upsert keyed
# on (schedule_version, code), then deactivate whatever is no longer current.
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json tsconfig.seed.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

# ---- Install production-only dependencies ----
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
# No `prisma generate` here any more. Under Prisma 6 this stage existed to put
# the generated client inside the production node_modules; in 7 the client is
# compiled into dist/generated/prisma by the build stage above, so generating
# it again here would produce nothing the runtime image uses.

# ---- Runtime image ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-seed ./dist-seed
COPY package.json ./
# `prisma migrate deploy` in the CMD below reads the datasource URL from this
# file, so it has to ship in the runtime image — without it the CLI has no
# connection string at all.
COPY prisma.config.ts ./

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist-seed/prisma/seed.js && node dist/main.js"]
