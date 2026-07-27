import fastify, { FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
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
import { healthRoutes } from '../../presentation/http/routes/health.routes';
import { authRoutes } from '../../presentation/http/routes/auth.routes';
import { babyRoutes } from '../../presentation/http/routes/baby.routes';
import { vaccineRoutes } from '../../presentation/http/routes/vaccine.routes';
import { appointmentRoutes } from '../../presentation/http/routes/appointment.routes';
import { milestoneRoutes } from '../../presentation/http/routes/milestone.routes';

export async function buildApp() {
  const app = fastify({ loggerInstance: logger }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      request.log.warn({ err: error }, 'request.validation_failed');
      return reply.status(400).send({ status: 'error', message: error.message });
    }

    request.log.error({ err: error }, 'request.unhandled_error');
    return reply.status(500).send({ status: 'error', message: 'Internal server error' });
  });

  await app.register(helmet);
  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(cookie);

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Meu Neném API',
        description: 'Backend API for meunenem.com',
        version: '0.1.0',
      },
      tags: [
        { name: 'Health', description: 'Infrastructure health checks' },
        { name: 'Auth', description: 'Authentication and session management' },
        { name: 'Babies', description: 'Baby profile management' },
        { name: 'Vaccines', description: 'Vaccination tracking' },
        { name: 'Appointments', description: 'Medical appointment scheduling' },
        { name: 'Milestones', description: 'Developmental milestone tracking' },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(babyRoutes);
  await app.register(vaccineRoutes);
  await app.register(appointmentRoutes);
  await app.register(milestoneRoutes);

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
