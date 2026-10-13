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
    // The CLI prefers a direct, non-pooled connection when one is configured.
    // `migrate deploy` holds a session-level advisory lock, which PgBouncer's
    // transaction pooling (Neon's `-pooler` host, what DATABASE_URL points at in
    // production) cannot release reliably; a direct connection has no such gap.
    // The application never reads this: it connects through DATABASE_URL.
    //
    // Keep `sslmode=require` on this URL, even when DATABASE_URL moves to `verify-full`. The two
    // are read by different code: DATABASE_URL by node-postgres, which verifies the certificate
    // under both values today, and this one by Prisma's schema engine, which honours `require` but
    // not `verify-full`. Tested on 2026-10-13 against a Postgres without TLS: `require` refused to
    // connect, and `verify-full` connected in plaintext.
    url: process.env['DIRECT_DATABASE_URL'] || process.env['DATABASE_URL'],
  },
});
