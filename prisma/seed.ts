import { PrismaClient } from '@prisma/client';
import { VACCINE_CATALOG_SEED } from './vaccine-catalog-seed-data';

const prisma = new PrismaClient();

async function main() {
  for (const vaccine of VACCINE_CATALOG_SEED) {
    await prisma.vaccine.upsert({
      where: { name_doseNumber: { name: vaccine.name, doseNumber: vaccine.doseNumber } },
      update: {
        description: vaccine.description,
        recommendedAgeInMonths: vaccine.recommendedAgeInMonths,
      },
      create: vaccine,
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
