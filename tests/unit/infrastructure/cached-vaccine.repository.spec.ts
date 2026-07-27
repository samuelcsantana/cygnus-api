import { describe, expect, it, vi } from 'vitest';
import { CachedVaccineRepository } from '../../../src/infrastructure/database/repositories/cached-vaccine.repository';
import { VaccineRepository } from '../../../src/application/vaccine/vaccine-repository';
import { CacheClient } from '../../../src/infrastructure/cache/cache-client';
import { Vaccine } from '../../../src/domain/vaccine/vaccine';

function buildVaccine(overrides: Partial<Parameters<typeof Vaccine.create>[0]> = {}): Vaccine {
  return Vaccine.create({
    id: 'vaccine-1',
    name: 'BCG',
    description: 'Protects against tuberculosis',
    recommendedAgeInMonths: 0,
    doseNumber: 1,
    ...overrides,
  });
}

function buildInnerRepository(overrides: Partial<VaccineRepository> = {}): VaccineRepository {
  return {
    findAll: vi.fn().mockResolvedValue([buildVaccine()]),
    findById: vi.fn().mockResolvedValue(buildVaccine()),
    ...overrides,
  };
}

function buildCacheClient(overrides: Partial<CacheClient> = {}): CacheClient {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    ...overrides,
  };
}

describe('CachedVaccineRepository', () => {
  it('fetches from the inner repository and populates the cache on a miss', async () => {
    const inner = buildInnerRepository();
    const cache = buildCacheClient();
    const repository = new CachedVaccineRepository(inner, cache);

    const vaccines = await repository.findAll();

    expect(inner.findAll).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith('vaccines:catalog', JSON.stringify(vaccines), 'EX', 3600);
    expect(vaccines).toHaveLength(1);
    expect(vaccines[0].name).toBe('BCG');
  });

  it('returns cached vaccines without touching the inner repository on a hit', async () => {
    const cachedPayload = JSON.stringify([
      { id: 'vaccine-1', name: 'BCG', description: 'Protects against tuberculosis', recommendedAgeInMonths: 0, doseNumber: 1 },
    ]);
    const inner = buildInnerRepository();
    const cache = buildCacheClient({ get: vi.fn().mockResolvedValue(cachedPayload) });
    const repository = new CachedVaccineRepository(inner, cache);

    const vaccines = await repository.findAll();

    expect(inner.findAll).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
    expect(vaccines).toHaveLength(1);
    expect(vaccines[0].name).toBe('BCG');
  });

  it('delegates findById directly to the inner repository without caching', async () => {
    const inner = buildInnerRepository();
    const cache = buildCacheClient();
    const repository = new CachedVaccineRepository(inner, cache);

    await repository.findById('vaccine-1');

    expect(inner.findById).toHaveBeenCalledWith('vaccine-1');
    expect(cache.get).not.toHaveBeenCalled();
  });
});
