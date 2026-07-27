import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CachedVaccineRepository } from '../../src/infrastructure/database/repositories/cached-vaccine.repository';
import { PrismaVaccineRepository } from '../../src/infrastructure/database/repositories/prisma-vaccine.repository';
import { prisma } from '../../src/infrastructure/database/prisma-client';
import { redis } from '../../src/infrastructure/cache/redis-client';
import { VACCINE_CATALOG_SEED } from '../../prisma/vaccine-catalog-seed-data';

const CACHE_KEY = 'vaccines:catalog';

describe('CachedVaccineRepository (real Redis + Postgres)', () => {
  beforeEach(async () => {
    await redis.del(CACHE_KEY);

    for (const vaccine of VACCINE_CATALOG_SEED) {
      await prisma.vaccine.upsert({
        where: { name_doseNumber: { name: vaccine.name, doseNumber: vaccine.doseNumber } },
        update: { description: vaccine.description },
        create: vaccine,
      });
    }
  });

  afterAll(async () => {
    await redis.del(CACHE_KEY);
    await prisma.$disconnect();
  });

  it('serves a cached catalog after the underlying data changes, until the cache is cleared', async () => {
    const repository = new CachedVaccineRepository(new PrismaVaccineRepository(prisma), redis);

    const firstRead = await repository.findAll();
    expect(firstRead.length).toBe(VACCINE_CATALOG_SEED.length);

    const bcg = await prisma.vaccine.findFirstOrThrow({ where: { name: 'BCG' } });
    const originalDescription = bcg.description;
    await prisma.vaccine.update({ where: { id: bcg.id }, data: { description: 'Updated description' } });

    const secondRead = await repository.findAll();
    const cachedBcg = secondRead.find((vaccine) => vaccine.id === bcg.id);
    expect(cachedBcg?.description).toBe(originalDescription);
    expect(cachedBcg?.description).not.toBe('Updated description');

    await redis.del(CACHE_KEY);

    const thirdRead = await repository.findAll();
    const freshBcg = thirdRead.find((vaccine) => vaccine.id === bcg.id);
    expect(freshBcg?.description).toBe('Updated description');
  });
});
