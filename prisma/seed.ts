import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { syncVaccineCatalog } from './sync-vaccine-catalog';

// Prisma 7 takes the driver explicitly and the schema no longer carries the
// URL (see prisma.config.ts), so this script has to build its own client
// rather than relying on a bare `new PrismaClient()`. `dotenv/config` because
// it runs under tsx, outside the app bootstrap that would otherwise load .env.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({ adapter });

async function main() {
  await syncVaccineCatalog(prisma);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
