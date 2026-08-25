import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildApp } from '../src/infrastructure/http/build-app';

/**
 * Writes the OpenAPI document to openapi.json at the repository root.
 *
 * The contract is committed rather than served, because `swagger-ui` is not registered in
 * production (see build-app.ts) — so without a file in the repository there is no way for the
 * frontend to read the contract of what is actually deployed, short of cloning this project and
 * running it. A committed document also makes a contract change visible in the diff of the pull
 * request that causes it, which is where a reviewer can still act on it.
 *
 * Publishing it costs nothing here: this repository is public, so every route, schema and
 * validation bound is already readable in src/presentation/http. This only makes the same
 * information machine-readable, and adds no runtime surface to the deployed service.
 *
 * The document does not depend on NODE_ENV — `@fastify/swagger` is registered in every environment
 * and it is only the UI that is conditional — so the values the environment is loaded with are
 * irrelevant to the output, and CI can pass placeholders for what `env.ts` insists on.
 */
const OUTPUT_PATH = path.resolve(__dirname, '..', 'openapi.json');

async function main() {
  const app = await buildApp();

  // The document is assembled from the routes as they are registered, so it is only complete
  // once the instance is ready.
  await app.ready();

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(app.swagger(), null, 2)}\n`);

  await app.close();

  // buildApp brings up the Prisma and ioredis clients as a side effect of importing the routers,
  // and ioredis keeps retrying a connection it will never get here. Nothing is left to flush, so
  // exit rather than wait for handles that stay open by design.
  process.exit(0);
}

void main();
