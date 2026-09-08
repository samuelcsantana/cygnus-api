# Ninho API · Cygnus

[![CI](https://github.com/samuelcsantana/cygnus-api/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/samuelcsantana/cygnus-api/actions/workflows/ci.yml)
[![Tests](https://github.com/samuelcsantana/cygnus-api/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/samuelcsantana/cygnus-api/actions/workflows/tests.yml)
[![Security](https://github.com/samuelcsantana/cygnus-api/actions/workflows/security.yml/badge.svg?branch=main)](https://github.com/samuelcsantana/cygnus-api/actions/workflows/security.yml)
[![MIT License](https://img.shields.io/github/license/samuelcsantana/cygnus-api)](LICENSE)
[![API line coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fsamuelcsantana.github.io%2Fcygnus-api%2Fbadge.json)](https://samuelcsantana.github.io/cygnus-api/)

![Fastify 5](https://img.shields.io/badge/Fastify-5-000000?logo=fastify)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Prisma 7](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)

Backend for **Ninho**, a mobile-first application that helps families organize children's health and development records. **Cygnus** remains the repository, infrastructure and API contract name.

[Live application](https://cygnus.samuelsantana.dev) · [Frontend repository](https://github.com/samuelcsantana/cygnus) · [OpenAPI contract](openapi.json) · [Coverage report](https://samuelcsantana.github.io/cygnus-api/)

## Features

- Password, Google and assisted email-code authentication, password recovery and account deletion confirmation.
- Child profiles, dated measurements, caregiver avatars and shared guardian access.
- Vaccination schedules and records, including a public Brazilian PNI schedule for external integrations.
- Appointments, medications, developmental milestones, professionals and health plans.
- Notifications and background reminder processing with BullMQ.
- Versioned legal document acceptance records.
- Audit logging, request validation and a committed OpenAPI contract.

Ninho is an organizational tool and does not replace professional healthcare advice.

## Architecture

Fastify 5 and strict TypeScript provide the HTTP layer; Prisma 7 and PostgreSQL store application data; Redis supports caching, authentication state and BullMQ jobs. Zod schemas drive request/response validation and OpenAPI generation. Resend handles transactional email.

| Directory | Responsibility |
| --- | --- |
| `src/domain/` | Entities, value objects and domain errors |
| `src/application/` | Use cases and service/repository contracts |
| `src/infrastructure/` | Prisma repositories, Redis, jobs, email and HTTP application assembly |
| `src/presentation/http/` | Routes, schemas, authentication plugins and HTTP utilities |
| `src/shared/` | Configuration, logging and shared utilities |
| `prisma/` | Schema, migrations and vaccine seed data |
| `tests/` | Unit and integration tests |
| `src/generated/` | Generated Prisma client; ignored and never edited manually |

Dependencies point toward domain and application contracts. Plain instance modules assemble services without a dependency injection framework.

## Local development

Use Node.js 24, npm, PostgreSQL and Redis. Copy [.env.example](.env.example) to `.env` and configure local credentials before starting services. Keep environment files out of version control.

```bash
npm ci
npm run prisma:generate
docker compose up -d postgres redis
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

The development API defaults to `http://localhost:3005`, with Swagger UI at `/docs`. Configure the separate frontend at `http://localhost:4205`.

### Docker

```bash
docker compose up -d --build
```

| Service | Default host port |
| --- | --- |
| API | 3005 |
| PostgreSQL | 5433 |
| Redis | 6379 |

Compose starts the API and its dependencies; it does not start the frontend. The API image is static, so rebuild it after source changes. Avoid running the container and the development server on the same port.

The container applies pending Prisma migrations before starting the server. It runs in production mode, so `/docs` and `/docs/json` return 404 even in local Docker. The local Compose configuration disables secure cookies for plain HTTP; production must use HTTPS.

## Authentication and API contract

Sessions use HttpOnly access and refresh cookies. Mutating authenticated requests use the CSRF cookie/header pair. Browser production traffic goes through the frontend's same-origin `/api/*` proxy. Public schedule endpoints deliberately allow anonymous access and do not carry account data.

See [Google sign-in setup](GOOGLE_AUTH.md) for credentials, callback URLs and account association rules. Secrets belong on the backend, never in frontend `VITE_*` variables.

[openapi.json](openapi.json) is generated from the route schemas and checked for drift in CI. Regenerate it after route or schema changes:

```bash
npm run openapi:generate
```

The contract is available as a repository file because Swagger HTTP routes are disabled in production. Keep the technical title **Cygnus API** and published paths stable for consumers.

## Tests and coverage

Integration tests use real PostgreSQL and Redis. They perform destructive cleanup and must run against a dedicated test database, never development or production records.

Copy [.env.test.example](.env.test.example) to `.env.test`, configure the dedicated `cygnus_db_test` database and Redis logical database `/1`, and follow that file's database creation instructions.

```bash
npm run prisma:generate
npm run test:migrate
npm test
npm run test:coverage
```

The test schema command uses `prisma db push` only for the disposable test database. Application databases use committed migrations. Spec files run sequentially to avoid cleanup races in shared test storage.

The [public V8 coverage report](https://samuelcsantana.github.io/cygnus-api/) measures lines, statements, functions and branches across authored `src/**/*.ts`, including modules not imported by tests. Generated Prisma code and type declarations are excluded. The badge shows line coverage from the latest successful main-branch Pages publication, combining API unit and integration tests. It does not include frontend tests or prove complete security coverage.

The Tests workflow publishes the measured report to Pages after successful tests on `main`, retains a report artifact for 14 days and includes the metrics in the Actions summary. No minimum coverage threshold is imposed initially.

## Commands and CI

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Typecheck and compile application and seed code |
| `npm start` | Run the compiled application |
| `npm test` | Unit and integration tests |
| `npm run test:coverage` | Tests, V8 coverage and report summary |
| `npm run openapi:generate` | Regenerate the API contract |
| `npm run prisma:generate` | Generate the Prisma client |
| `npm run prisma:migrate` | Create/apply development migrations |
| `npm run prisma:migrate:deploy` | Apply committed migrations |
| `npm run prisma:seed` | Seed the vaccine catalog |
| `npm run prisma:studio` | Open Prisma Studio |

CI validates compilation and OpenAPI drift. Separate workflows run the database-backed tests and dependency security checks. There is currently no lint script; the build performs TypeScript checks. Workflow badges describe their checks, not a security certification.

## Deployment and current limitations

Render configuration lives in `render.yaml`; Docker configuration lives in `Dockerfile` and `docker-compose.yml`. Production uses PostgreSQL on Neon and Redis on Render. Merging to `main` triggers deployment, and container startup applies pending database migrations.

Uploads are served through public URLs and do not currently provide private file access control. Local Docker uses an upload volume, but production file durability depends on hosting storage. Keep original files. The reminder worker shares the API process, so scheduled delivery depends on that process remaining available.

Account deletion does not guarantee immediate removal of all uploads, logs or provider backups. Current export functionality is partial. See the web [Privacy Policy](https://cygnus.samuelsantana.dev/privacidade) and [Terms of Use](https://cygnus.samuelsantana.dev/termos) for the service's documented behavior.

The frontend and API have independent versions. The planned Android application and future optional cloud offering are outside this repository's current deliverables.

## License and contact

Distributed under the [MIT License](LICENSE), copyright © 2026 Samuel Santana. Third-party dependencies retain their own licenses.

Maintainer: Samuel Santana — [samuel.ssa89@gmail.com](mailto:samuel.ssa89@gmail.com).
