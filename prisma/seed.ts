import { PrismaClient } from '@prisma/client';
import { syncVaccineCatalog } from './sync-vaccine-catalog';

const prisma = new PrismaClient();

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
