import { vi } from 'vitest';
import { BabyRepository } from '../../../../src/application/baby/baby-repository';
import { Baby } from '../../../../src/domain/baby/baby';

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
