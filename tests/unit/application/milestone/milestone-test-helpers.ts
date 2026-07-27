import { vi } from 'vitest';
import { BabyRepository } from '../../../../src/application/baby/baby-repository';
import { MilestoneRepository } from '../../../../src/application/milestone/milestone-repository';
import { Baby } from '../../../../src/domain/baby/baby';
import { Milestone } from '../../../../src/domain/milestone/milestone';

export const babyBirthDate = new Date('2024-01-01T00:00:00.000Z');

export function buildBaby(overrides: Partial<Parameters<typeof Baby.create>[0]> = {}): Baby {
  return Baby.create({
    id: 'baby-1',
    userId: 'owner-id',
    name: 'Baby Doe',
    birthDate: babyBirthDate,
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

export function buildMilestone(overrides: Partial<Parameters<typeof Milestone.record>[0]> = {}): Milestone {
  return Milestone.record({
    id: 'milestone-1',
    babyId: 'baby-1',
    title: 'Primeiro sorriso',
    achievedAt: new Date('2024-03-01T00:00:00.000Z'),
    category: 'SOCIAL',
    babyBirthDate,
    referenceDate: new Date('2024-06-01T00:00:00.000Z'),
    ...overrides,
  });
}

export function buildMilestoneRepository(overrides: Partial<MilestoneRepository> = {}): MilestoneRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findAllByBabyId: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
