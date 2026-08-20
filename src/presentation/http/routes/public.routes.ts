import type { App } from '../../../infrastructure/http/build-app';
import { PrismaVaccineRepository } from '../../../infrastructure/database/repositories/prisma-vaccine.repository';
import { CachedVaccineRepository } from '../../../infrastructure/database/repositories/cached-vaccine.repository';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { redis } from '../../../infrastructure/cache/redis-client';
import { publicVaccineScheduleResponseSchema } from '../schemas/public.schema';

/**
 * The only unauthenticated, cross-origin-readable surface of this API.
 *
 * Everything under /public/ answers with `Access-Control-Allow-Origin: *` and, critically,
 * WITHOUT `Access-Control-Allow-Credentials` — see the CORS delegate in build-app.ts. That pairing
 * is what makes it safe: a wildcard origin and cookies are mutually exclusive by browser rule, so
 * a page on any origin can read this data but can never make an authenticated call here on a
 * visitor's behalf.
 *
 * The rule for anything added under this prefix: it must be data that is identical for every
 * visitor and tied to no account. The PNI immunization schedule qualifies — it is published public
 * health policy, the same rows for everyone, and carries no personal data at all.
 */
/**
 * Exported so the CORS delegate in build-app.ts matches on the same string this router mounts.
 * If these two ever drift, the failure is silent and one-directional: routes would still answer,
 * but under the strict policy, so the widget breaks in the browser while every server-side probe
 * (curl, health check, integration test without an Origin header) keeps passing.
 */
export const PUBLIC_ROUTE_PREFIX = '/public/';

export async function publicRoutes(app: App) {
  // Reads go through the Redis-backed cache, not straight to Postgres. This endpoint is the one
  // that an embedded widget on someone else's site hits, so its traffic is the least predictable
  // of the whole API — and the catalog changes about as often as national policy does.
  const vaccineRepository = new CachedVaccineRepository(new PrismaVaccineRepository(prisma), redis);

  app.route({
    method: 'GET',
    url: '/public/vaccine-schedule',
    schema: {
      tags: ['Public'],
      summary: 'The PNI immunization schedule (public, no authentication)',
      description:
        'Returns the Brazilian national immunization schedule as reference data. Readable from any origin so it ' +
        'can back an embeddable widget. Contains no personal data and requires no authentication.',
      response: {
        200: publicVaccineScheduleResponseSchema,
      },
    },
    handler: async (_request, reply) => {
      const vaccines = await vaccineRepository.findAll();

      const schedule = vaccines
        .map((vaccine) => ({
          id: vaccine.id,
          name: vaccine.name,
          description: vaccine.description,
          recommendedAgeInMonths: vaccine.recommendedAgeInMonths,
          doseNumber: vaccine.doseNumber,
        }))
        .sort((a, b) =>
          a.recommendedAgeInMonths === b.recommendedAgeInMonths
            ? a.doseNumber - b.doseNumber
            : a.recommendedAgeInMonths - b.recommendedAgeInMonths,
        );

      // Reference data that changes with national policy, not with usage: worth caching hard at
      // the edge and in the browser. `public` is deliberate — there is nothing per-visitor here,
      // so a shared cache holding one copy for everyone is correct rather than a leak.
      return reply.header('cache-control', 'public, max-age=3600').send({ schedule });
    },
  });
}
