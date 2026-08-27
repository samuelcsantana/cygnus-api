import fs from 'node:fs';
import fastify, { FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import type { FastifyCorsOptionsDelegateCallback } from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { env } from '../../shared/config/env';
import { logger } from '../../shared/logging/logger';
import { MILESTONE_PHOTOS_DIR, UPLOADS_DIR } from '../../shared/config/uploads';
import { healthRoutes } from '../../presentation/http/routes/health.routes';
import { publicRoutes, PUBLIC_ROUTE_PREFIX } from '../../presentation/http/routes/public.routes';
import { authRoutes } from '../../presentation/http/routes/auth.routes';
import { userRoutes } from '../../presentation/http/routes/user.routes';
import { babyRoutes } from '../../presentation/http/routes/baby.routes';
import { vaccineRoutes } from '../../presentation/http/routes/vaccine.routes';
import { appointmentRoutes } from '../../presentation/http/routes/appointment.routes';
import { milestoneRoutes } from '../../presentation/http/routes/milestone.routes';
import { inviteRoutes } from '../../presentation/http/routes/invite.routes';
import { notificationRoutes } from '../../presentation/http/routes/notification.routes';
import { specialtyRoutes } from '../../presentation/http/routes/specialty.routes';
import { uploadRoutes } from '../../presentation/http/routes/upload.routes';

export async function buildApp() {
  const app = fastify({
    loggerInstance: logger,
    // Without this, Fastify reads the raw socket address as the client IP —
    // behind Render's reverse proxy that is Render's own IP on every single
    // request, so @fastify/rate-limit's 100/minute would be a single bucket
    // shared by the entire internet instead of a per-client limit. Trusting
    // X-Forwarded-For is only safe because this service is always behind a
    // proxy that overwrites it; do not copy this into something exposed
    // directly. vertex-api carries the same fix for the same reason.
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      request.log.warn({ err: error }, 'request.validation_failed');
      return reply.status(400).send({ status: 'error', message: error.message });
    }

    // @fastify/rate-limit throws a plain Error with statusCode 429 set — without this, it fell
    // through to the generic 500 branch below and masked the real "too many requests" response.
    if (error.statusCode === 429) {
      request.log.warn({ err: error }, 'request.rate_limited');
      return reply.status(429).send({ status: 'error', message: error.message });
    }

    // Fastify's own errors arrive carrying the status they should be answered with: an empty body
    // sent with a JSON content-type is FST_ERR_CTP_EMPTY_JSON_BODY at 400, a wrong content-type is
    // 415, an oversized payload 413. Without this branch every one of them fell through to the 500
    // below, which tells the caller the server broke when it was the request that did — and files
    // a fixable client mistake under "we have an outage".
    //
    // Their messages are framework text about the shape of the request ("Body cannot be empty when
    // content-type is set to 'application/json'"), not anything of ours, so echoing them says only
    // what the caller needs in order to send it correctly next time.
    if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
      request.log.warn({ err: error, statusCode: error.statusCode }, 'request.client_error');
      return reply.status(error.statusCode).send({ status: 'error', message: error.message });
    }

    request.log.error({ err: error }, 'request.unhandled_error');
    return reply.status(500).send({ status: 'error', message: 'Internal server error' });
  });

  await app.register(helmet);
  // Two CORS policies in one registration, chosen per request.
  //
  // Everything except /public/ keeps the strict policy: a single allowed origin, with
  // credentials — that is what lets the SameSite=Strict session cookies work while still
  // stopping a page on another origin from calling this API as the visitor.
  //
  // /public/ gets the opposite: any origin, and NO credentials. The two halves are load-bearing
  // together. `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Credentials: true` are
  // mutually exclusive by browser rule, so omitting credentials is not a detail to tidy up later
  // — it is the reason a wildcard here cannot be turned into an authenticated request. A widget
  // embedded on any site can read the vaccine schedule; nothing can read a session with it.
  await app.register(cors, (): FastifyCorsOptionsDelegateCallback => (request, callback) => {
    if (request.url.startsWith(PUBLIC_ROUTE_PREFIX)) {
      callback(null, { origin: '*', credentials: false, methods: ['GET', 'OPTIONS'] });
      return;
    }

    callback(null, { origin: env.CORS_ORIGIN, credentials: true });
  });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });

  // Created eagerly (not lazily on first upload) so `@fastify/static` finds the directory at
  // registration time instead of just logging a "root path must exist" warning on a fresh
  // checkout/container. The upload route also creates it defensively before every write.
  fs.mkdirSync(MILESTONE_PHOTOS_DIR, { recursive: true });

  // Publicly served (no auth) — milestone photos are plain public image URLs today with no
  // access control, same as an externally-hosted `photoUrl` would be, so this isn't a new
  // exposure. Only uploading (POST /uploads/milestone-photos) requires authentication.
  await app.register(staticFiles, { root: UPLOADS_DIR, prefix: '/uploads/' });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Cygnus API',
        description: 'Backend API for the Cygnus project',
        version: '0.1.0',
      },
      tags: [
        { name: 'Health', description: 'Infrastructure health checks' },
        { name: 'Public', description: 'Unauthenticated reference data, readable from any origin' },
        { name: 'Auth', description: 'Authentication and session management' },
        { name: 'Users', description: "The authenticated user's own profile and account" },
        { name: 'Babies', description: 'Baby profile management' },
        { name: 'Vaccines', description: 'Vaccination tracking' },
        { name: 'Appointments', description: 'Medical appointment scheduling' },
        { name: 'Milestones', description: 'Developmental milestone tracking' },
        { name: 'Guardians', description: 'Sharing a baby profile between multiple adults via invite codes' },
        { name: 'Notifications', description: 'In-app alerts for delayed vaccines and upcoming appointments' },
        { name: 'Uploads', description: 'File uploads (milestone photos)' },
      ],
    },
    transform: jsonSchemaTransform,
  });

  // The Swagger UI (and its /docs/json OpenAPI document) exposes the full API surface — only
  // wire it up outside production so it's never reachable on a public deployment.
  if (env.NODE_ENV !== 'production') {
    await app.register(swaggerUi, { routePrefix: '/docs' });
  }

  await app.register(publicRoutes);
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(babyRoutes);
  await app.register(vaccineRoutes);
  await app.register(appointmentRoutes);
  await app.register(milestoneRoutes);
  await app.register(inviteRoutes);
  await app.register(notificationRoutes);
  await app.register(specialtyRoutes);
  await app.register(uploadRoutes);

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
