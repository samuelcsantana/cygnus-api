import { PrismaClient } from '@prisma/client';
import { env } from '../../shared/config/env';

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
