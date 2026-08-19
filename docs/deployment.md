# Deployment (Render)

`render.yaml` is a Blueprint: from the Render dashboard, **New → Blueprint**, point it at this repository, and it
creates the web service and the Key Value (Redis) instance, wired to each other.

## The database is Neon, not Render

Deliberately outside the Blueprint. Render's free Postgres is **deleted after 30 days**, which is an unacceptable
home for the only copy of anyone's vaccination records — the kind of default that is fine for a demo and quietly
catastrophic for a real user. Neon's free tier persists.

`DATABASE_URL` is therefore a prompted secret (`sync: false`) rather than a `fromDatabase` reference. Two things
to get right when pasting it:

- **Use the pooled connection string** (the host containing `-pooler`), with `sslmode=require`. This service keeps
  a long-lived pool of its own, and Neon's free tier caps direct connections low enough that a redeploy
  overlapping the previous instance can exhaust them.
- **Migrations may need the direct host.** `prisma migrate deploy` runs on container start and does not always
  behave through a transaction pooler. A prepared-statement error at boot is that, not a schema problem — point
  the migration at the non-pooled host.

## Domains, and why they are not arbitrary

| Service | Host |
|---|---|
| frontend (`cygnus`, on Vercel) | `cygnus.samuelsantana.dev` |
| this API (on Render) | `api.cygnus.samuelsantana.dev` |

Both sit under `samuelsantana.dev`, and that is the whole point rather than a cosmetic choice.

The auth cookies are issued `SameSite=Strict` (`src/presentation/http/utils/auth-cookies.ts`). A browser only sends
those to a **same-site** destination, and "same site" means the same registrable domain — `samuelsantana.dev` here.
Had the frontend stayed on a `*.vercel.app` URL and this API on `*.onrender.com`, the two would be different sites:
login would return 200, set a cookie the browser then declines to send back, and every request after it would 401.
The bug looks like a broken session rather than a domain problem, which is what makes it expensive.

So `CORS_ORIGIN` in `render.yaml` is not just an allowlist entry. **Pointing it at a host outside
`samuelsantana.dev` silently breaks authentication**, no matter how correct CORS itself looks.

`SECURE_COOKIES` needs no setting: it defaults to `NODE_ENV === 'production'`, and Render terminates TLS.

## `trustProxy`

Enabled in `build-app.ts`. Without it Fastify reads the raw socket address as the client IP, which behind Render's
reverse proxy is Render's own IP on every request — `@fastify/rate-limit`'s 100/minute would then be a single
bucket shared by the entire internet rather than a per-client limit. `vertex-api` carries the same fix for the same
reason.

## Open problems — read before this carries real users

### Uploaded photos do not survive a deploy

`UPLOADS_DIR` resolves to a directory inside the container (`src/shared/config/uploads.ts`), and Render's filesystem
is ephemeral. Every deploy and every restart **deletes every milestone photo a user uploaded**, while the database
rows keep pointing at files that no longer exist.

Under `docker compose` this is handled by the `cygnus_uploads_data` volume. Render has no equivalent on the free
tier. Two ways out, neither done yet: a paid persistent disk, or moving uploads to object storage (S3, as
`flash-finance-api` already does).

This is data loss, not degradation. It should block any real use.

### The Prisma CLI is downloaded on every boot

The runtime image installs with `npm ci --omit=dev`, and `prisma` is a devDependency — but the container's `CMD`
runs `npx prisma migrate deploy` before starting the server. `npx` therefore fetches the CLI from the network on
every cold start. On the free tier, where the service sleeps and cold-starts often, that turns a registry hiccup
into a service that will not boot.

The fix is to make the CLI present in the runtime image. It is deliberately **not** done here: the Prisma 7 upgrade
(PR #3) rewrites this Dockerfile, and fixing the same file in two open branches guarantees a conflict. Do it once,
after that lands.

### Free tier shapes behaviour, not just cost

- A free web service sleeps when idle. The BullMQ worker runs in this same process, so it sleeps too — the 08:00
  reminder sweep will not fire dependably until this is a paid instance. The retry and dead-letter work in
  `docs/queue-reliability.md` assumes a process that is actually running at 08:00.

## Secrets

`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` use `generateValue: true`, so Render generates them and they never
exist in this repository or in anyone's shell history. Rotating them is a dashboard action.

`RESEND_API_KEY` and `RESEND_FROM_EMAIL` are `sync: false`: Render prompts on first apply and never reads them from
this file. Leaving the key empty is supported — `EmailService` logs a warning and no-ops instead of throwing.
