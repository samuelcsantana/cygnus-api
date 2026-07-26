# CLAUDE.md - Backend API Guidelines for "Meu Neném" (meunenem.com)

## 1. Communication & Language Rules
- **Conversation with User:** ALWAYS communicate, explain, and answer questions in **Portuguese (PT-BR)**.
- **Codebase Language:** All code, variable names, class names, methods, database columns, Git commits, documentation, and automated tests MUST be written entirely in **English**.

## 2. Architectural Principles (Pragmatic Clean Architecture)
Apply Clean Architecture and Domain-Driven Design (DDD) concepts without over-engineering (respect KISS and YAGNI).
- **Layers:**
  1. `Domain`: Entities, Value Objects, and Domain Exceptions (Zero external dependencies).
  2. `Application`: Use Cases / Services and Interfaces/Contracts (Business logic).
  3. `Infrastructure`: Database implementations (ORMs/Repositories), external sender providers (e.g., Resend, FCM), security tools, and Docker configuration.
  4. `Presentation`: HTTP Controllers, Routes, Request/Response DTOs, and OpenAPI/Swagger Documentation.
- **SOLID & DRY:** Depend on abstractions (interfaces), not implementations. Avoid code duplication, but do not create premature abstractions for single-use cases (avoid YAGNI violations).

## 3. Local Infrastructure, Docker & Database Migrations
- **Docker First:** ALWAYS provide and maintain a `docker-compose.yml` file at the root level to run local infrastructure (e.g., PostgreSQL database and Redis for caching/background jobs).
- **Database Version Control (Migrations):** 
  - NEVER use auto-synchronization features (like `synchronize: true` in TypeORM or raw pushes without history) in production or standard workflows.
  - Every database schema change MUST be tracked using automated **Migrations** (via Prisma Migrations, TypeORM Migrations, etc.).
  - When creating or updating a Domain entity, immediately generate the corresponding database migration and provide clear terminal commands to run it.

## 4. API Documentation (Swagger / OpenAPI - Strictly Mandatory)
- **The Contract Source of Truth:** The Angular frontend relies strictly on the backend documentation. Therefore, **Every single HTTP endpoint MUST be documented using Swagger/OpenAPI**.
- **Automated Schema Generation:** Integrate Swagger directly with input validation tools (e.g., using `@fastify/swagger`, `@fastify/swagger-ui`, and `fastify-type-provider-zod` or equivalent modern Express adapters).
- **Completeness:** Endpoints must explicitly document:
  - Route path, HTTP method, and tags (categorized by feature: e.g., `Auth`, `Babies`, `Vaccines`, `Appointments`).
  - Expected Request Body, Query Params, and Headers (including Zod schemas).
  - All possible Response Status Codes (`200`, `201`, `400`, `401`, `403`, `404`, `500`) with their exact JSON payload structures.

## 5. Security First & Modern Frontend Readiness
- **Authentication:** Implement JWT (Access + Refresh Token pattern).
- **Storage:** Sensitive tokens MUST be transmitted via **HTTP-Only, Secure, SameSite=Strict Cookies** to prevent XSS attacks. Never return tokens in the JSON body for client-side storage.
- **CORS:** Configure CORS strictly to accept requests ONLY from the authorized Angular frontend domain (`http://localhost:4200` for local dev, and `https://meunenem.com` for production), with `credentials: true`.
- **Protection:** Implement Input Validation (using Zod), Rate Limiting, and security headers (Helmet).

## 6. Git Workflow (Gitflow + Semantic & Atomic Commits + Single Authorship)
- Maintain strict branch separation: `main` (production), `develop` (staging), and feature branches (`feature/name-of-feature`).
- **Semantic Commits:** Strictly follow the **Conventional Commits** specification in English (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`) to clearly communicate the intent of every change.
- **Atomic Commits:** Every commit MUST represent a single, indivisible logical unit of work that compiles and passes tests independently. NEVER bundle unrelated changes (e.g., adding a new endpoint while refactoring an unrelated database query) into a single commit.
- **Strict Single Authorship (No Co-authors):** NEVER add `Co-authored-by:` trailers, AI tool attributions, or any other co-author tags in Git commit messages. Commits MUST be attributed exclusively to the primary developer.
- **Squash and Merge Readiness:** Maintain clean, cohesive, and logical feature branches so they can be squashed seamlessly into staging or production without losing historical context.

## 7. Testing Strategy
- **Unit Tests:** Focus heavily on the `Application` (Use Cases) and `Domain` layers. Mock all external dependencies and repositories.
- **Integration Tests:** Test HTTP endpoints from the `Presentation` layer down to a Dockerized test database (using tools like Supertest + Vitest/Jest).
- **Avoid Anti-patterns:** Do not write redundant tests. Avoid testing framework boilerplate; test business rules and edge cases (e.g., trying to schedule an appointment in the past).