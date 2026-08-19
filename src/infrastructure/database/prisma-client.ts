import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../../shared/config/env';

// Prisma 7 removed the Rust query engine, so the driver is supplied explicitly
// through an adapter instead of being resolved from the schema's datasource
// block. The connection string comes from the same validated env object the
// rest of the app uses — schema.prisma no longer reads `env("DATABASE_URL")`
// itself, and prisma.config.ts covers the CLI's own need for it.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
