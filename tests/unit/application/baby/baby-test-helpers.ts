import { vi } from 'vitest';
import { BabyRepository } from '../../../../src/application/baby/baby-repository';
import { BabyGuardianRepository } from '../../../../src/application/baby/baby-guardian-repository';
import { Baby } from '../../../../src/domain/baby/baby';
import { BabyGuardian } from '../../../../src/domain/baby/baby-guardian';

export function buildBabyRepository(overrides: Partial<BabyRepository> = {}): BabyRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findAllByUserId: vi.fn().mockResolvedValue([]),
    findAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function buildBaby(overrides: Partial<Parameters<typeof Baby.create>[0]> = {}): Baby {
  return Baby.create({
    id: 'baby-id',
    userId: 'owner-id',
    name: 'Baby Doe',
    birthDate: new Date('2024-01-15T00:00:00.000Z'),
    gender: 'FEMALE',
    ...overrides,
  });
}

export function buildBabyGuardian(overrides: Partial<Parameters<typeof BabyGuardian.create>[0]> = {}): BabyGuardian {
  return BabyGuardian.create({
    id: 'guardian-id',
    babyId: 'baby-id',
    userId: 'owner-id',
    role: 'OWNER',
    ...overrides,
  });
}

// Every fixture baby in this file defaults to `userId: 'owner-id'` — this default mirrors that
// convention so the many existing "owner succeeds / intruder-id gets BabyNotFoundError" tests
// keep working without threading a matching guardian mock through every single test case.
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
