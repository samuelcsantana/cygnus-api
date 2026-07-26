import { z } from 'zod';

export const healthySchema = z
  .object({
    status: z.literal('ok'),
    uptimeSeconds: z.number().int().nonnegative().describe('Process uptime in seconds'),
    timestamp: z.string().datetime().describe('ISO-8601 timestamp of the check'),
    database: z.literal('up'),
  })
  .describe('The API and its dependencies are healthy');

export const unhealthySchema = z
  .object({
    status: z.literal('error'),
    message: z.string(),
    database: z.literal('down'),
  })
  .describe('The API is running but a critical dependency is unavailable');

export type HealthyResponse = z.infer<typeof healthySchema>;
export type UnhealthyResponse = z.infer<typeof unhealthySchema>;
