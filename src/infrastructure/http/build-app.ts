import fastify from 'fastify';
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

export async function buildApp() {
  const app = fastify({ loggerInstance: logger }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet);
  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

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
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(healthRoutes);

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
