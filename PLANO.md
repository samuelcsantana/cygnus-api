# Plano de Desenvolvimento — API "Cygnus" (domínio de produção ainda não definido)

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

## Fase 6 — Redis: Cache + Lembretes em Background ✅ (concluída)

### 6.1 Cache do catálogo de vacinas
- [x] Cliente Redis compartilhado (`ioredis`) e abstração `CacheClient`
      (interface mínima `get`/`set`, para permitir mocks em teste sem
      depender de um Redis real).
- [x] `CachedVaccineRepository` (decorator sobre `PrismaVaccineRepository`):
      cacheia `findAll()` com TTL de 1h, sem invalidação manual (catálogo
      quase não muda). `findById()` não é cacheado.
- [x] Testes unitários (mock de `CacheClient`) e um teste de integração
      contra Redis + Postgres reais, provando que dados ficam "obsoletos"
      dentro do TTL até o cache ser limpo.

### 6.2 Fila de lembretes (Notifications)
- [x] Entidade `Notification` (id, userId, babyId, type
      [`VACCINE_DELAYED`, `APPOINTMENT_UPCOMING`], referenceId, title,
      message, readAt, createdAt). Migration com `@@unique([babyId, type,
      referenceId])` para nunca notificar o mesmo gatilho duas vezes.
- [x] `BabyRepository.findAll()` adicionado (o job varre todos os bebês do
      sistema, não só os de um usuário).
- [x] `GenerateReminderNotificationsUseCase`: reaproveita
      `BabyVaccineRecord.derive` para detectar vacinas atrasadas e cria
      notificação para consultas agendadas dentro de uma janela de 3 dias.
      Deduplicação via `NotificationRepository.existsForTrigger`.
- [x] `ListUserNotificationsUseCase`, `MarkNotificationAsReadUseCase`.
- [x] Fila BullMQ (`reminders`) com job repetível diário (cron `0 8 * * *`),
      processado por um worker que roda no mesmo processo da API
      (`main.ts`), com conexão Redis dedicada (workers do BullMQ usam
      comandos bloqueantes, por isso não compartilham a conexão do cache).
      O worker usa os repositórios Prisma diretos (não o cache), para que a
      varredura diária sempre veja os dados mais recentes.
- [x] Rotas `GET /notifications` e `PATCH /notifications/:notificationId/read`,
      protegidas pelo guard JWT, tag `Notifications` no Swagger. **Sem envio
      externo de e-mail/push** — não há provedor (Resend/FCM) configurado
      ainda; a notificação é hoje só um alerta in-app consumido via API.

### 6.3 Fechamento
- [x] 137 testes (unitários + integração) passando, sem regressão nos
      módulos anteriores. Build (`tsc`) validado.
- [x] Verificação manual ponta a ponta: job disparado manualmente,
      processado pelo worker real contra Redis/Postgres do
      `docker-compose.yml`.
- [x] Commits semânticos atômicos: `feat(cache)`, `feat(domain)`,
      `feat(notification)` (migration, use cases, rotas), `feat(queue)`.

---

## Fase 7 — Refresh de Sessão, `/auth/me` e Fix do Job de Lembretes ✅ (concluída)

Motivada pelo checklist de prontidão para produção do frontend
(`cygnus/PRODUCTION_READINESS.md`): dois bloqueadores 🔴 (sessão expira em 15min
sem refresh; identidade se perde a cada F5) e um bloqueador com causa raiz
ainda não investigada (notificações nunca confirmadas ponta a ponta).

### 7.1 Investigação — notificações vazias
- [x] Causa raiz encontrada: `scheduleDailyReminderJob` (Fase 6.2) registra o
      job repetível do BullMQ com `repeat: { pattern: '0 8 * * *' }` sem
      `immediately: true` — o primeiro disparo só acontece na próxima
      ocorrência do cron (8h), nunca ao subir o servidor. Qualquer sessão de
      teste manual fora desse horário via `GET /notifications` ficava vazia
      mesmo com vacina atrasada de verdade no banco.
- [x] Corrigido adicionando `immediately: true` em `reminder-queue.ts`.
      Validado localmente: log `reminders.generated` dispara na subida do
      servidor, não só às 8h.

### 7.2 Application/Infrastructure
- [x] `TokenService.verifyRefreshToken` + implementação em
      `JwtTokenService` (valida o `refresh_token` contra `JWT_REFRESH_SECRET`,
      confirma `type: 'refresh'` no payload).
- [x] `RefreshUserSessionUseCase`: valida o refresh token, confirma que o
      usuário ainda existe (`UserRepository.findById`) e emite um novo par de
      tokens — cobre o caso de um refresh token válido de um usuário já
      deletado.

### 7.3 Presentation
- [x] `POST /auth/refresh`: lê o cookie `refresh_token`, rotaciona
      `access_token`/`refresh_token` via `setAuthCookies` (mesmo helper do
      login). 401 + limpa os cookies se o refresh token for inválido/expirado.
- [x] `GET /auth/me`: protegida pelo guard JWT existente, retorna
      `{ id, email, name, createdAt }` do usuário autenticado.
- [x] Documentação Swagger completa (tag `Auth`) para as duas rotas novas.

### 7.4 Fechamento
- [x] 145 testes (unitários + integração) passando — incluindo
      `refresh-user-session.use-case.spec.ts` (novo) e extensão de
      `tests/integration/auth.spec.ts` cobrindo rotação de cookie, 401 sem
      cookie, 401 com token inválido, e o novo endpoint no doc OpenAPI
      gerado. Build (`tsc`) validado.
- [x] Commits semânticos atômicos: `fix(queue)` (job imediato),
      `feat(auth)` (refresh + me).

**Nota de infra (fora do escopo de "fase" de domínio):** nesta mesma sessão
o projeto foi renomeado de "Meu Neném" para "Cygnus" (containers, volumes
Docker, `package.json`, título do Swagger, fixtures de teste — commit
`chore: rename project from Meu Neném to Cygnus`) e ganhou um `Dockerfile`
multi-stage + serviço `api` no `docker-compose.yml`, containerizando o
backend do mesmo jeito que Postgres/Redis já estavam (commit
`build: containerize the api service`).

---

## Fase 8 — `DELETE /babies/:babyId` ✅ (concluída)

Motivada pelo checklist de prontidão para produção do frontend
(`cygnus/PRODUCTION_READINESS.md`): a exclusão de perfil de bebê ficava
travada na UI porque o endpoint nunca existiu no contrato da API — item que
tinha ficado órfão, sinalizado do lado do frontend mas nunca virado tarefa
aqui.

### 8.1 Domain/Application
- [x] `BabyRepository.delete(id)` (interface) + implementação em
      `PrismaBabyRepository` (`prisma.baby.delete`).
- [x] `DeleteBabyUseCase`: mesma checagem de posse usada em
      `GetBabyByIdUseCase`/`UpdateBabyUseCase` (`BabyNotFoundError` uniforme
      quando o bebê não existe ou pertence a outro usuário).

### 8.2 Infrastructure
- [x] Nenhuma migration nova necessária — todas as relações filhas de `Baby`
      (`BabyVaccineRecord`, `Appointment`, `Milestone`, `Notification`) já
      tinham `onDelete: Cascade` no `schema.prisma` desde suas respectivas
      fases.

### 8.3 Presentation
- [x] Rota `DELETE /babies/:babyId`, protegida pelo guard JWT, retorna `204`
      sem corpo (`401`/`404`/`500` documentados). Documentação Swagger
      completa na tag `Babies`.

### 8.4 Fechamento
- [x] Testes unitários (`delete-baby.use-case.spec.ts`) cobrindo sucesso,
      bebê de outro usuário e bebê inexistente. Teste de integração cobrindo
      cascata de exclusão, isolamento entre usuários (`404` para intruso) e
      exposição da rota no documento OpenAPI gerado.
- [x] Commit semântico atômico: `feat(baby)` (repository, use case, rota,
      testes).

---

## Fase 9 — `Appointment.specialty` de ponta a ponta ✅ (concluída)

Motivada pela reconstrução de UX do frontend (unificação das telas de
Vacinas/Consultas/Marcos em listas únicas entre-filhos, `cygnus/PRODUCTION_READINESS.md`):
ao testar o fluxo de agendar consulta com dados reais, `POST
/babies/:babyId/appointments` retornava `500`, e mesmo corrigindo isso a
resposta falhava na validação Zod do frontend (`specialty` ausente onde o
schema exigia `string | null`).

### 9.1 Causa raiz
- A migration `20260804020154_add_appointment_specialty` só adicionou a
  coluna via SQL cru; `prisma/schema.prisma`, a entidade de domínio
  `Appointment`, os use cases de criar/atualizar, o repositório Prisma e os
  schemas de rota (`appointment.schema.ts`) nunca foram atualizados para
  ler/gravar o campo — apesar de o frontend, a lista estática de
  especialidades (`medical-specialty.ts`) e o formulário já existirem
  prontos para ele. Mesma classe de bug já corrigida antes para o calendário
  de vacinas (campos de lote/local/profissional/foto).
- Adicionalmente, o banco de **dev** (container Docker) não tinha a coluna de
  fato — a migration estava marcada como aplicada em `_prisma_migrations`
  sem o `ALTER TABLE` ter rodado. Corrigido aplicando a coluna manualmente
  (mesmo tipo de drift já visto na Fase de `avatar_color`, ver histórico do
  `cygnus` no mesmo período).

### 9.2 Correção
- [x] `schema.prisma`: campo `specialty String?` na model `Appointment`
      (sem migration nova — `prisma migrate status` já considerava a coluna
      aplicada; só `prisma generate` foi necessário).
- [x] Domínio (`Appointment`), `CreateAppointmentUseCase`,
      `UpdateAppointmentUseCase`, `PrismaAppointmentRepository` e
      `appointment.routes.ts`/`appointment.schema.ts` passam a ler/gravar/
      retornar `specialty` (nullable, opcional na criação).
- [x] `appointment-test-helpers.ts` (fixture de teste) atualizado.

### 9.3 Fechamento
- [x] 27 testes de `appointment` (unitários + integração) passando; suíte
      completa em 188/190 (ver nota abaixo). Build (`tsc -b`) validado.
- [x] Commit semântico atômico: `fix(appointment)`.

**Nota — flake pré-existente, não corrigido nesta fase:** com a suíte
completa (`npm run test`), 2 testes de
`tests/integration/vaccine.spec.ts` (`stores and returns batch number,
location, professional and photo details`) falham por dados que não batem
(`expected undefined to match object`) — mas passam isoladamente ou rodando
só o arquivo. Não investigado a fundo ainda; suspeita é o cache Redis do
catálogo de vacinas (`CachedVaccineRepository`, TTL de 1h sem invalidação,
Fase 6.1) devolvendo dado obsoleto de outro arquivo de teste quando a suíte
inteira roda em sequência. Próxima sessão: checar se o `CacheClient` usado
nos testes de integração é isolado por arquivo ou compartilha estado entre
`vaccine.spec.ts` e outros specs.

---

## Fases Futuras (fora do escopo imediato, não iniciar sem alinhamento)

- Envio real de lembretes por e-mail/push (Resend, FCM ou similar) —
  hoje as notificações são só in-app.
- Testes de integração ponta a ponta contra banco Dockerizado
  (Supertest + Vitest) — já parcialmente coberto pela suíte atual, que roda
  contra o Postgres e o Redis do `docker-compose.yml`.

---

## Convenções Transversais (válidas em todas as fases)

- Comunicação com o usuário em PT-BR; todo código, commits e testes em inglês.
- Nunca usar `synchronize`/push automático de schema — sempre migration
  versionada.
- Toda rota nova precisa de documentação Swagger completa (request, response,
  todos os status codes relevantes).
- Tokens JWT nunca no corpo da resposta — sempre cookies HTTP-Only/Secure/
  SameSite=Strict.
- CORS restrito à origem local de dev e ao domínio de produção
  (ainda a ser definido), com `credentials: true`.
- Cada fase fecha com testes verdes + commit atômico semântico, sem
  `Co-authored-by`.
