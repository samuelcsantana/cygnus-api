import { vi } from 'vitest';
import { BabyRepository } from '../../../../src/application/baby/baby-repository';
import { BabyGuardianRepository } from '../../../../src/application/baby/baby-guardian-repository';
import { VaccineRepository } from '../../../../src/application/vaccine/vaccine-repository';
import { BabyVaccineRecordRepository } from '../../../../src/application/vaccine/baby-vaccine-record-repository';
import { Baby } from '../../../../src/domain/baby/baby';
import { BabyGuardian } from '../../../../src/domain/baby/baby-guardian';
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

export function buildBabyGuardian(overrides: Partial<Parameters<typeof BabyGuardian.create>[0]> = {}): BabyGuardian {
  return BabyGuardian.create({
    id: 'guardian-1',
    babyId: 'baby-1',
    userId: 'owner-id',
    role: 'OWNER',
    ...overrides,
  });
}

// Mirrors buildBaby()'s default `userId: 'owner-id'` so existing "owner succeeds / intruder-id
// gets BabyNotFoundError" tests keep working without a matching guardian mock in every test case.
export function buildBabyGuardianRepository(overrides: Partial<BabyGuardianRepository> = {}): BabyGuardianRepository {
  return {
    findByBabyAndUser: vi.fn((_babyId: string, userId: string) =>
      Promise.resolve(userId === 'owner-id' ? buildBabyGuardian({ userId }) : null),
    ),
    findAllByBaby: vi.fn().mockResolvedValue([]),
    findAllByUser: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(buildBabyGuardian()),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function buildVaccine(overrides: Partial<Parameters<typeof Vaccine.create>[0]> = {}): Vaccine {
  return Vaccine.create({
    id: 'vaccine-1',
    code: 'birth-bcg',
    name: 'BCG',
    description: 'Protects against tuberculosis',
    guidance: null,
    recommendedAgeInMonths: 0,
    doseNumber: 1,
    recommendationKind: 'ROUTINE',
    scheduleVersion: 'test-2026',
    effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
    effectiveTo: null,
    isActive: true,
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
    findById: vi.fn().mockResolvedValue(null),
    findAllByBabyId: vi.fn().mockResolvedValue([]),
    findByBabyAndVaccine: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
