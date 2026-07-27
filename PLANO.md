# Plano de Desenvolvimento — API "Meu Neném" (meunenem.com)

> Documento vivo. Cada fase deve terminar com testes passando e commit semântico
> atômico (sem co-autoria), conforme `CLAUDE.md`. Marcar checkboxes conforme o
> progresso avança.

## Visão Geral

API para o app "Agenda do Bebê" (mHealth): centraliza dados de saúde infantil
(vacinas, consultas, marcos de desenvolvimento) para pais/cuidadores, com forte
ênfase em prevenção (alertas de calendário vacinal) e comunicação com
pediatras. Stack: Node.js + TypeScript + Fastify + Prisma (PostgreSQL),
Pragmatic Clean Architecture (`Domain` → `Application` → `Infrastructure` →
`Presentation`).

---

## Fase 0 — Bootstrap do Projeto ✅ (concluída em `32a01ad`)

- [x] Projeto Node.js + TypeScript, Fastify, Prisma (PostgreSQL).
- [x] Estrutura de pastas Clean Architecture (`src/domain`, `src/application`,
      `src/infrastructure`, `src/presentation`, `src/shared`).
- [x] `docker-compose.yml` (PostgreSQL) e `.env.example`.
- [x] `@fastify/swagger` + `@fastify/swagger-ui` + `fastify-type-provider-zod`
      expostos em `/docs`.
- [x] `GET /health` documentado no Swagger.
- [x] Teste de integração de health check (`tests/integration/health.spec.ts`).

**Pendência técnica identificada:** o `prisma/schema.prisma` atual só contém o
model `InfrastructureCheck` (validação do pipeline Docker/Prisma). Ele deve ser
removido assim que o primeiro model de domínio real (`User`) for criado na
Fase 1, para não conviver com tabelas de negócio.

---

## Fase 1 — Módulo de Usuário e Autenticação ✅ (concluída)

### 1.1 Domain
- [x] Entidade `User` (id, email, passwordHash, name, createdAt) em
      `src/domain/user/`.
- [x] Value Objects/validações: `Email` (formato), nome não vazio.
- [x] Erros de domínio: `InvalidEmailError`, `InvalidNameError`.

### 1.2 Infrastructure
- [x] Migration Prisma para tabela `users` (removido `InfrastructureCheck` do
      schema).
- [x] Interface `UserRepository` (Application) + implementação
      `PrismaUserRepository` (Infrastructure).
- [x] Serviço de hashing (`bcrypt`) e serviço de JWT (access + refresh via
      `jsonwebtoken`) como adapters de infraestrutura.

### 1.3 Application
- [x] `RegisterUserUseCase` (valida e-mail único, gera hash de senha).
- [x] `AuthenticateUserUseCase` (valida credenciais, emite access + refresh
      token JWT).
- [x] Testes unitários mockando `UserRepository` para os dois casos de uso
      (sucesso, e-mail duplicado, credenciais inválidas).

### 1.4 Presentation
- [x] Rotas: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`.
- [x] Login injeta tokens **somente** via cookies HTTP-Only, Secure,
      SameSite=Strict (`@fastify/cookie`) — nunca no corpo JSON.
- [x] Guard de autenticação Fastify (`authenticate`, em
      `src/presentation/http/plugins/authenticate.ts`) reutilizável pelas
      próximas fases (Babies).
- [x] Documentação Swagger completa (tag `Auth`): request/response Zod
      schemas, status codes `200`, `201`, `400`, `401`, `409`, `500`.

### 1.5 Fechamento
- [x] Testes unitários (5) + integração (9) passando, build (`tsc`) validado.
- [x] Commits semânticos atômicos: `feat(domain)`, `feat(user)`,
      `feat(auth)` (hashing/JWT, use cases, rotas), `chore(deps)`.

---

## Fase 2 — Perfil do Bebê (`Baby`) ✅ (concluída)

### 2.1 Domain
- [x] Entidade `Baby` (id, userId, name, birthDate, gender, bloodType,
      allergies, avatarUrl, createdAt).
- [x] Regra de domínio: `birthDate` não pode ser data futura (validação na
      criação da entidade, com erro `FutureBirthDateError`).

### 2.2 Infrastructure
- [x] Migration Prisma: relação 1:N `User` → `Baby` (um usuário pode ter
      múltiplos bebês).
- [x] `BabyRepository` (interface + implementação Prisma).

### 2.3 Application
- [x] `CreateBabyUseCase`, `ListUserBabiesUseCase`, `GetBabyByIdUseCase`,
      `UpdateBabyUseCase`.
- [x] Testes unitários cobrindo isolamento entre usuários: usuário A não pode
      ler/alterar bebê de usuário B (`BabyNotFoundError` uniforme em vez de
      403, para não vazar a existência do recurso — mitigação OWASP BOLA).

### 2.4 Presentation
- [x] CRUD protegido pelo guard de autenticação JWT criado na Fase 1
      (`authenticate`).
- [x] Documentação Swagger completa na tag `Babies`.

### 2.5 Fechamento
- [x] 30 testes (unitários + integração) passando, sem regressão no módulo
      Auth. Corrigido um problema de paralelismo do Vitest entre arquivos de
      integração que compartilham o mesmo banco Postgres.
- [x] Commits semânticos atômicos: `feat(domain)`, `feat(baby)` (migration,
      use cases, rotas), `fix(tests)`.

---

## Fase 3 — Motor de Vacinação (`Vaccine Schedule`) ✅ (concluída)

### 3.1 Domain
- [x] Entidade `Vaccine` (id, name, description, recommendedAgeInMonths,
      doseNumber).
- [x] Entidade `BabyVaccineRecord` (id, babyId, vaccineId, status [`PENDING`,
      `APPLIED`, `DELAYED`], applicationDate, notes). `PENDING`/`DELAYED` são
      calculados em tempo de leitura (`BabyVaccineRecord.derive`, comparando
      dias de calendário em UTC) em vez de persistidos como estado
      potencialmente obsoleto; apenas `APPLIED` é gravado no banco.

### 3.2 Infrastructure
- [x] Migration Prisma para `vaccines` e `baby_vaccine_records` (registro
      persistido só existe quando a dose é marcada como aplicada).
- [x] Seeder (`prisma/seed.ts` + `prisma/vaccine-catalog-seed-data.ts`) com as
      5 vacinas básicas do calendário infantil brasileiro (BCG ao nascer,
      Hepatite B ao nascer, Pentavalente/VIP/Pneumocócica 10-valente aos 2
      meses).

### 3.3 Application
- [x] `GetBabyVaccineScheduleUseCase`: recebe `babyId`, busca `birthDate`,
      calcula PENDENTE vs. ATRASADA com base na data de referência, retorna
      calendário agrupado por faixa etária (ordenado ascendente).
- [x] `MarkVaccineAsAppliedUseCase`: upsert do registro aplicado, com
      isolamento por dono do bebê (mesma regra do módulo Baby).
- [x] Testes unitários de lógica de datas: `addMonthsClamped` (fim de mês,
      ano bissexto, virada de ano), `BabyVaccineRecord.derive` (vacina devida
      hoje não é atraso), cenários completos no use case (recém-nascido,
      vacina atrasada, vacina aplicada antecipadamente).

### 3.4 Presentation
- [x] Rotas: `GET /babies/:babyId/vaccines`,
      `PATCH /babies/:babyId/vaccines/:vaccineId/apply`, protegidas pelo
      guard JWT.
- [x] Documentação Swagger na tag `Vaccines`.

### 3.5 Fechamento
- [x] 57 testes (unitários + integração) passando, sem regressão em
      Auth/Baby. Build (`tsc`) validado.
- [x] Commits semânticos atômicos: `feat(domain)`, `feat(vaccine)`
      (migration/seeder, use cases, rotas).

---

## Fase 4 — Consultas Pediátricas (`Appointments`) ✅ (concluída)

### 4.1 Domain
- [x] Entidade `Appointment` (id, babyId, scheduledAt, doctorName, location,
      reason, notes, status [`SCHEDULED`, `COMPLETED`, `CANCELLED`],
      createdAt).
- [x] Regra de domínio: `scheduledAt` não pode ser no passado — validada
      apenas em `Appointment.schedule()` (criação) e quando o use case de
      update recebe um novo `scheduledAt` explícito. `Appointment.restore()`
      não revalida, permitindo completar/cancelar consultas cujo horário já
      passou.

### 4.2 Infrastructure
- [x] Migration Prisma: relação 1:N `Baby` → `Appointment`.
- [x] `AppointmentRepository` (interface + implementação Prisma).

### 4.3 Application
- [x] `CreateAppointmentUseCase`, `ListBabyAppointmentsUseCase`,
      `GetAppointmentByIdUseCase`, `UpdateAppointmentUseCase` (reagendar,
      anotar, marcar como concluída/cancelada).
- [x] Testes cobrindo isolamento entre usuários, rejeição de data passada ao
      criar/reagendar, e o caso crítico de completar uma consulta cujo
      horário já passou (sem re-disparar a validação de data passada).

### 4.4 Presentation
- [x] Rotas: `POST/GET /babies/:babyId/appointments`,
      `GET/PATCH /babies/:babyId/appointments/:appointmentId`, protegidas
      pelo guard JWT.
- [x] Documentação Swagger na tag `Appointments`.

### 4.5 Fechamento
- [x] 84 testes (unitários + integração) passando, sem regressão nos módulos
      anteriores. Build (`tsc`) validado.
- [x] Commits semânticos atômicos: `feat(domain)`, `feat(appointment)`
      (migration, use cases, rotas).

---

## Fase 5 — Marcos de Desenvolvimento (`Milestones`) ✅ (concluída)

### 5.1 Domain
- [x] Entidade `Milestone` (id, babyId, title, description, achievedAt,
      category [`MOTOR`, `LANGUAGE`, `SOCIAL`, `COGNITIVE`, `OTHER`],
      photoUrl, createdAt).
- [x] Regras de domínio: `achievedAt` não pode ser no futuro nem anterior ao
      `birthDate` do bebê (comparação por dia de calendário em UTC,
      reaproveitando `startOfUtcDay`). Validadas apenas em
      `Milestone.record()` (criação) e quando o update recebe um novo
      `achievedAt` explícito — `Milestone.restore()` não revalida.

### 5.2 Infrastructure
- [x] Migration Prisma: relação 1:N `Baby` → `Milestone`.
- [x] `MilestoneRepository` (interface + implementação Prisma).

### 5.3 Application
- [x] `CreateMilestoneUseCase`, `ListBabyMilestonesUseCase`,
      `GetMilestoneByIdUseCase`, `UpdateMilestoneUseCase`.
- [x] Testes cobrindo isolamento entre usuários, rejeição de data futura,
      rejeição de data anterior ao nascimento, e atualização parcial sem
      revalidar uma `achievedAt` antiga não alterada.

### 5.4 Presentation
- [x] Rotas: `POST/GET /babies/:babyId/milestones`,
      `GET/PATCH /babies/:babyId/milestones/:milestoneId`, protegidas pelo
      guard JWT.
- [x] Documentação Swagger na tag `Milestones` (tag nova adicionada ao
      Swagger).

### 5.5 Fechamento
- [x] 114 testes (unitários + integração) passando, sem regressão nos
      módulos anteriores. Build (`tsc`) validado.
- [x] Commits semânticos atômicos: `feat(domain)`, `feat(milestone)`
      (migration, use cases, rotas).

---

## Fases Futuras (fora do escopo imediato, não iniciar sem alinhamento)

- Redis para cache/jobs em background (lembretes, notificações).
- Testes de integração ponta a ponta contra banco Dockerizado
  (Supertest + Vitest) — já parcialmente coberto pela suíte atual, que roda
  contra o Postgres do `docker-compose.yml`.

---

## Convenções Transversais (válidas em todas as fases)

- Comunicação com o usuário em PT-BR; todo código, commits e testes em inglês.
- Nunca usar `synchronize`/push automático de schema — sempre migration
  versionada.
- Toda rota nova precisa de documentação Swagger completa (request, response,
  todos os status codes relevantes).
- Tokens JWT nunca no corpo da resposta — sempre cookies HTTP-Only/Secure/
  SameSite=Strict.
- CORS restrito a `http://localhost:4200` (dev) e `https://meunenem.com`
  (produção), com `credentials: true`.
- Cada fase fecha com testes verdes + commit atômico semântico, sem
  `Co-authored-by`.
