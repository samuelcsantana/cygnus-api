import type { App } from '../../../infrastructure/http/build-app';
import { CheckHealthUseCase } from '../../../application/health/check-health.use-case';
import { DatabaseUnavailableError } from '../../../domain/health/errors/database-unavailable.error';
import { PrismaHealthChecker } from '../../../infrastructure/health/prisma-health-checker';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { healthySchema, unhealthySchema } from '../schemas/health.schema';

export async function healthRoutes(app: App) {
  const checkHealthUseCase = new CheckHealthUseCase(new PrismaHealthChecker(prisma));

  app.route({
    method: 'GET',
    url: '/health',
    schema: {
      tags: ['Health'],
      summary: 'Check API health',
      description: 'Verifies that the API process is running and that the PostgreSQL database is reachable.',
      response: {
        200: healthySchema,
        503: unhealthySchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const report = await checkHealthUseCase.execute();
        request.log.info({ report }, 'health.check_succeeded');
        return reply.status(200).send(report);
      } catch (error) {
        if (error instanceof DatabaseUnavailableError) {
          request.log.error({ err: error }, 'health.check_failed');
          return reply.status(503).send({
            status: 'error',
            message: error.message,
            database: 'down',
          });
        }

        throw error;
      }
    },
  });
}
