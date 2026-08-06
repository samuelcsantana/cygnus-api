import { z } from 'zod';

export const medicalSpecialtyListResponseSchema = z
  .array(z.string())
  .describe('Static reference list of medical specialties used to power appointment form suggestions');
