import { describe, expect, it, vi } from 'vitest';
import { UpdateMilestoneUseCase } from '../../../../src/application/milestone/update-milestone.use-case';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { MilestoneNotFoundError } from '../../../../src/application/milestone/errors/milestone-not-found.error';
import { FutureMilestoneDateError } from '../../../../src/domain/milestone/errors/future-milestone-date.error';
import { buildBabyRepository, buildMilestone, buildMilestoneRepository, buildBabyGuardianRepository } from './milestone-test-helpers';

describe('UpdateMilestoneUseCase', () => {
  it('updates only the provided fields', async () => {
    const milestone = buildMilestone();
    const babyRepository = buildBabyRepository();
    const milestoneRepository = buildMilestoneRepository({ findById: vi.fn().mockResolvedValue(milestone) });
    const useCase = new UpdateMilestoneUseCase(babyRepository, buildBabyGuardianRepository(), milestoneRepository);

    const updated = await useCase.execute({
      babyId: 'baby-1',
      milestoneId: milestone.id,
      requestingUserId: 'owner-id',
      description: 'Aconteceu durante o banho',
    });

    expect(updated.description).toBe('Aconteceu durante o banho');
    expect(updated.title).toBe(milestone.title);
    expect(updated.achievedAt).toEqual(milestone.achievedAt);
    expect(milestoneRepository.save).toHaveBeenCalledWith(updated);
  });

  it('does not revalidate the existing achievedAt when it is left unchanged, even if now in the past', async () => {
    const oldMilestone = buildMilestone({
      achievedAt: new Date('2020-01-01T00:00:00.000Z'),
      babyBirthDate: new Date('2019-01-01T00:00:00.000Z'),
      referenceDate: new Date('2020-01-01T00:00:00.000Z'),
    });
    const babyRepository = buildBabyRepository();
    const milestoneRepository = buildMilestoneRepository({ findById: vi.fn().mockResolvedValue(oldMilestone) });
    const useCase = new UpdateMilestoneUseCase(babyRepository, buildBabyGuardianRepository(), milestoneRepository);

    const updated = await useCase.execute({
      babyId: 'baby-1',
      milestoneId: oldMilestone.id,
      requestingUserId: 'owner-id',
      photoUrl: 'https://example.com/photo.jpg',
    });

    expect(updated.photoUrl).toBe('https://example.com/photo.jpg');
    expect(updated.achievedAt).toEqual(oldMilestone.achievedAt);
  });

  it('rejects changing achievedAt to a future date', async () => {
    const milestone = buildMilestone();
    const babyRepository = buildBabyRepository();
    const milestoneRepository = buildMilestoneRepository({ findById: vi.fn().mockResolvedValue(milestone) });
    const useCase = new UpdateMilestoneUseCase(babyRepository, buildBabyGuardianRepository(), milestoneRepository);

    await expect(
      useCase.execute({
        babyId: 'baby-1',
        milestoneId: milestone.id,
        requestingUserId: 'owner-id',
        achievedAt: new Date('2024-07-01T00:00:00.000Z'),
        referenceDate: new Date('2024-06-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow(FutureMilestoneDateError);

    expect(milestoneRepository.save).not.toHaveBeenCalled();
  });

  it("rejects updating another user's milestone", async () => {
    const milestone = buildMilestone();
    const babyRepository = buildBabyRepository();
    const milestoneRepository = buildMilestoneRepository({ findById: vi.fn().mockResolvedValue(milestone) });
    const useCase = new UpdateMilestoneUseCase(babyRepository, buildBabyGuardianRepository(), milestoneRepository);

    await expect(
      useCase.execute({
        babyId: 'baby-1',
        milestoneId: milestone.id,
        requestingUserId: 'intruder-id',
        description: 'Hacked',
      }),
    ).rejects.toThrow(BabyNotFoundError);
  });

  it('rejects updating a milestone that does not exist', async () => {
    const babyRepository = buildBabyRepository();
    const milestoneRepository = buildMilestoneRepository({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new UpdateMilestoneUseCase(babyRepository, buildBabyGuardianRepository(), milestoneRepository);

    await expect(
      useCase.execute({
        babyId: 'baby-1',
        milestoneId: 'missing-id',
        requestingUserId: 'owner-id',
        description: 'irrelevant',
      }),
    ).rejects.toThrow(MilestoneNotFoundError);
  });
});
