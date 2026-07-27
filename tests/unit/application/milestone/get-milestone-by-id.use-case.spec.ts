import { describe, expect, it, vi } from 'vitest';
import { GetMilestoneByIdUseCase } from '../../../../src/application/milestone/get-milestone-by-id.use-case';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { MilestoneNotFoundError } from '../../../../src/application/milestone/errors/milestone-not-found.error';
import { buildBabyRepository, buildMilestone, buildMilestoneRepository } from './milestone-test-helpers';

describe('GetMilestoneByIdUseCase', () => {
  it("returns the milestone when it belongs to the requesting user's baby", async () => {
    const milestone = buildMilestone();
    const babyRepository = buildBabyRepository();
    const milestoneRepository = buildMilestoneRepository({ findById: vi.fn().mockResolvedValue(milestone) });
    const useCase = new GetMilestoneByIdUseCase(babyRepository, milestoneRepository);

    const result = await useCase.execute({
      babyId: 'baby-1',
      milestoneId: milestone.id,
      requestingUserId: 'owner-id',
    });

    expect(result).toBe(milestone);
  });

  it("rejects with BabyNotFoundError when the baby belongs to another user", async () => {
    const babyRepository = buildBabyRepository();
    const useCase = new GetMilestoneByIdUseCase(babyRepository, buildMilestoneRepository());

    await expect(
      useCase.execute({ babyId: 'baby-1', milestoneId: 'milestone-1', requestingUserId: 'intruder-id' }),
    ).rejects.toThrow(BabyNotFoundError);
  });

  it('rejects with MilestoneNotFoundError when the milestone does not exist', async () => {
    const babyRepository = buildBabyRepository();
    const milestoneRepository = buildMilestoneRepository({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new GetMilestoneByIdUseCase(babyRepository, milestoneRepository);

    await expect(
      useCase.execute({ babyId: 'baby-1', milestoneId: 'missing-id', requestingUserId: 'owner-id' }),
    ).rejects.toThrow(MilestoneNotFoundError);
  });

  it('rejects with MilestoneNotFoundError when the milestone belongs to a different baby', async () => {
    const milestone = buildMilestone({ babyId: 'other-baby-id' });
    const babyRepository = buildBabyRepository();
    const milestoneRepository = buildMilestoneRepository({ findById: vi.fn().mockResolvedValue(milestone) });
    const useCase = new GetMilestoneByIdUseCase(babyRepository, milestoneRepository);

    await expect(
      useCase.execute({ babyId: 'baby-1', milestoneId: milestone.id, requestingUserId: 'owner-id' }),
    ).rejects.toThrow(MilestoneNotFoundError);
  });
});
