import { vi } from 'vitest';
import { BabyRepository } from '../../../../src/application/baby/baby-repository';
import { VaccineRepository } from '../../../../src/application/vaccine/vaccine-repository';
import { BabyVaccineRecordRepository } from '../../../../src/application/vaccine/baby-vaccine-record-repository';
import { Baby } from '../../../../src/domain/baby/baby';
import { Vaccine } from '../../../../src/domain/vaccine/vaccine';

export function buildBaby(overrides: Partial<Parameters<typeof Baby.create>[0]> = {}): Baby {
  return Baby.create({
    id: 'baby-1',
    userId: 'owner-id',
    name: 'Baby Doe',
    birthDate: new Date('2024-01-01T00:00:00.000Z'),
    gender: 'FEMALE',
    ...overrides,
  });
}

export function buildBabyRepository(overrides: Partial<BabyRepository> = {}): BabyRepository {
  return {
    findById: vi.fn().mockResolvedValue(buildBaby()),
    findAllByUserId: vi.fn().mockResolvedValue([]),
    findAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function buildVaccine(overrides: Partial<Parameters<typeof Vaccine.create>[0]> = {}): Vaccine {
  return Vaccine.create({
    id: 'vaccine-1',
    name: 'BCG',
    description: 'Protects against tuberculosis',
    recommendedAgeInMonths: 0,
    doseNumber: 1,
    ...overrides,
  });
}

export function buildVaccineRepository(overrides: Partial<VaccineRepository> = {}): VaccineRepository {
  return {
    findAll: vi.fn().mockResolvedValue([buildVaccine()]),
    findById: vi.fn().mockResolvedValue(buildVaccine()),
    ...overrides,
  };
}

export function buildBabyVaccineRecordRepository(
  overrides: Partial<BabyVaccineRecordRepository> = {},
): BabyVaccineRecordRepository {
  return {
    findAllByBabyId: vi.fn().mockResolvedValue([]),
    findByBabyAndVaccine: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
