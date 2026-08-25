# cygnus-api

Backend API for **Cygnus** — a mobile-first app that helps parents track their child's health and development (vaccines, appointments, developmental milestones). Consumed by the `cygnus` frontend (separate repository).

## Stack

- Fastify 5 + TypeScript
- Prisma ORM + PostgreSQL
- Redis (BullMQ background jobs)
- Zod validation (`fastify-type-provider-zod`) + Swagger/OpenAPI docs
- JWT auth (Access + Refresh) via HTTP-only cookies
- Vitest

## Running locally

```bash
npm install
cp .env.example .env   # fill in secrets
npm run prisma:migrate
npm run dev
```

Runs on `http://localhost:3005`. Swagger docs at `http://localhost:3005/docs`.

## Docker

This is the backend half of a front+back pair with `cygnus` (the React frontend, `http://localhost:4205`).

```bash
docker compose up -d --build
```

Brings up Postgres, Redis, and the API together:

| Service | Port |
|---|---|
| `api` | `3005` (from `PORT` in `.env`) |
| `postgres` | `5433` (from `POSTGRES_PORT`) |
| `redis` | `6379` (from `REDIS_PORT`) |

The compose file intentionally does **not** define a `web` service — `cygnus` lives in its own repository with its own `docker-compose.yml` and points `VITE_API_BASE_URL` at wherever this API is reachable (defaults to `http://localhost:3005`). Run both compose stacks side by side for full-stack local development.

On container start, `npx prisma migrate deploy` runs automatically before the server boots.

## API contract

[`openapi.json`](./openapi.json) is the OpenAPI 3.0 document for every endpoint, committed and kept
current by CI — regenerate it with `npm run openapi:generate` after changing any route. Point a
client generator (`openapi-typescript`, `orval`) at it, or read it as the source of truth for
request and response shapes.

It is a file rather than a URL because the Swagger UI is registered only outside production, so
`/docs` answers 404 on the deployed service. Running locally (`npm run dev`), the same document is
browsable at `http://localhost:3005/docs`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload (`tsx watch`) |
| `npm run openapi:generate` | Regenerate `openapi.json` from the routes |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm test` | Tests (Vitest) |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:migrate:deploy` | Apply pending migrations (production/Docker) |
| `npm run prisma:studio` | Open Prisma Studio |
