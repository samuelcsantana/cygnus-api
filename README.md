# cygnus-api

Backend API for **Meu Neném** ("My Baby") — a mobile-first app that helps parents track their child's health and development (vaccines, appointments, developmental milestones). Consumed by the `cygnus` frontend (separate repository). See `CLAUDE.md` for full architecture, security, and workflow conventions.

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

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm test` | Tests (Vitest) |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:migrate:deploy` | Apply pending migrations (production/Docker) |
| `npm run prisma:studio` | Open Prisma Studio |
