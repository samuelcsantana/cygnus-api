import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Replaces the `prisma` key in package.json, which Prisma 6 deprecated and
// Prisma 7 removed. The datasource URL moved here too: `schema.prisma` no
// longer reads `env("DATABASE_URL")` itself, so this file is the single place
// that turns an environment variable into a connection string for the CLI.
//
// `dotenv/config` is imported for the same reason it is in src/shared/config/env.ts
// — the CLI is run directly (and through `dotenv -e .env.test` in tests), not
// through the application bootstrap.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
