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

## Region

Both services declare `region: ohio` because the Neon project lives in `aws-us-east-2`. Render's default is
Oregon, so leaving the field out would put a US-west API in front of a US-east database and add a
cross-continent round trip to **every** query — invisible in the build, visible in every response time.

The Key Value instance repeats the region for a harder reason: Render's private networking only reaches
services in the same region, and `REDIS_URL` is wired through `fromService`. A region mismatch there does not
degrade performance, it fails to connect.

Neither is adjustable later. Render fixes a service's region at creation; changing it means deleting the
service and applying the Blueprint again.

## Domains: the plan, and what replaced it

| Service | Host |
|---|---|
| frontend (`cygnus`, on Vercel) | `cygnus.samuelsantana.dev` |
| this API (on Render) | `cygnus-api.onrender.com` |

They are on different registrable domains, and that would normally break authentication outright.

The auth cookies are issued `SameSite=Strict` (`src/presentation/http/utils/auth-cookies.ts`), and a browser sends
those only to a **same-site** destination — the same registrable domain. The original plan was therefore
`api.cygnus.samuelsantana.dev`, sharing `samuelsantana.dev` with the frontend. **Render only offers custom domains
on paid instances**, so on the free plan this service cannot leave `*.onrender.com`.

Called directly from `cygnus.samuelsantana.dev`, that is a cross-site pair: login returns 200, the browser stores
the cookie and then declines to send it back, and every request after it 401s. The bug looks like a broken session
rather than a domain problem, which is what makes it expensive.

`SameSite=None` is the obvious escape and is a dead end — Safari's ITP blocks third-party cookies outright and
Chrome is moving the same way, so cross-site auth cookies are not weaker, they are broken in a real browser today.

**The frontend proxies instead.** `cygnus/vercel.json` rewrites `/api/*` and `/uploads/*` to this service, so the
browser only ever talks to its own origin. Same-origin is stricter than same-site, so `Strict` cookies work by
construction. Two things follow for this repository:

- **Nothing here needs to know about the proxy**, and that is deliberate. One caveat found the hard way: Vercel
  forwards the *original* `Host` header, so `upload.routes.ts` — which builds a photo's public URL from
  `request.headers.host` — returns a URL on the frontend's host. That is why `/uploads/*` is proxied too. Adding a
  `PUBLIC_BASE_URL` here would have worked as well and was rejected: it puts the deployment topology into the
  application.
- **`CORS_ORIGIN` is no longer what holds the session together.** The browser makes no cross-origin call to this
  API at all. It still matters, because this host stays publicly reachable: it is what stops a page on another
  origin from calling this API with a user's cookies.

`SECURE_COOKIES` needs no setting: it defaults to `NODE_ENV === 'production'`, and both Render and Vercel
terminate TLS.

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
