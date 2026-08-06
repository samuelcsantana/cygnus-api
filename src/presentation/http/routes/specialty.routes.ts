import type { App } from '../../../infrastructure/http/build-app';
import { MEDICAL_SPECIALTIES } from '../../../domain/appointment/medical-specialty';
import { medicalSpecialtyListResponseSchema } from '../schemas/specialty.schema';

export async function specialtyRoutes(app: App) {
  app.route({
    method: 'GET',
    url: '/specialties',
    schema: {
      tags: ['Appointments'],
      summary: 'List medical specialties',
      description:
        'Returns the static reference list of medical specialties used to power autocomplete suggestions on ' +
        'the appointment form. Public — not tied to any user or baby.',
      response: {
        200: medicalSpecialtyListResponseSchema,
      },
    },
    handler: async (_request, reply) => {
      return reply.status(200).send([...MEDICAL_SPECIALTIES]);
    },
  });
}
