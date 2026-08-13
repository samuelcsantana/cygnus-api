import { Prisma, PrismaClient } from '@prisma/client';
import { ACTIVE_VACCINE_CATALOG } from '../src/shared/config/vaccine-catalog';
import { VACCINE_CATALOG_LEGACY_MATCHES, VACCINE_CATALOG_SEED } from './vaccine-catalog-seed-data';

async function syncInTransaction(client: Prisma.TransactionClient): Promise<void> {
  const effectiveFrom = new Date(`${ACTIVE_VACCINE_CATALOG.effectiveFrom}T00:00:00.000Z`);
  const activeCodes = VACCINE_CATALOG_SEED.map((entry) => entry.code);

  await client.vaccine.updateMany({
    where: {
      isActive: true,
      OR: [
        { scheduleVersion: { not: ACTIVE_VACCINE_CATALOG.version } },
        {
          scheduleVersion: ACTIVE_VACCINE_CATALOG.version,
          code: { notIn: activeCodes },
        },
      ],
    },
    data: { isActive: false, effectiveTo: effectiveFrom },
  });

  for (const vaccine of VACCINE_CATALOG_SEED) {
    const existingCurrentEntry = await client.vaccine.findUnique({
      where: {
        scheduleVersion_code: {
          scheduleVersion: vaccine.scheduleVersion,
          code: vaccine.code,
        },
      },
    });

    if (!existingCurrentEntry) {
      const legacyMatches = VACCINE_CATALOG_LEGACY_MATCHES.get(vaccine.code) ?? [];
      const legacyEntry =
        legacyMatches.length > 0
          ? await client.vaccine.findFirst({
              where: {
                scheduleVersion: 'LEGACY',
                OR: legacyMatches.map((match) => ({ name: match.name, doseNumber: match.doseNumber })),
              },
            })
          : null;

      if (legacyEntry) {
        // Reuse the original row so existing BabyVaccineRecord foreign keys keep pointing
        // to the equivalent current schedule entry after the one-time legacy migration.
        await client.vaccine.update({ where: { id: legacyEntry.id }, data: vaccine });
        continue;
      }
    }

    await client.vaccine.upsert({
      where: {
        scheduleVersion_code: {
          scheduleVersion: vaccine.scheduleVersion,
          code: vaccine.code,
        },
      },
      update: {
        name: vaccine.name,
        description: vaccine.description,
        guidance: vaccine.guidance,
        recommendedAgeInMonths: vaccine.recommendedAgeInMonths,
        doseNumber: vaccine.doseNumber,
        recommendationKind: vaccine.recommendationKind,
        effectiveFrom: vaccine.effectiveFrom,
        effectiveTo: null,
        isActive: true,
      },
      create: vaccine,
    });
  }
}

export async function syncVaccineCatalog(client: PrismaClient): Promise<void> {
  await client.$transaction((transaction) => syncInTransaction(transaction), { timeout: 15_000 });
}
