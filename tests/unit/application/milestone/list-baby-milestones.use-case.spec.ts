import { describe, expect, it, vi } from 'vitest';
import { ListBabyMilestonesUseCase } from '../../../../src/application/milestone/list-baby-milestones.use-case';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { buildBabyRepository, buildMilestone, buildMilestoneRepository } from './milestone-test-helpers';

describe('ListBabyMilestonesUseCase', () => {
  it("returns the owning user's baby milestones", async () => {
    const milestone = buildMilestone();
    const babyRepository = buildBabyRepository();
    const milestoneRepository = buildMilestoneRepository({
      findAllByBabyId: vi.fn().mockResolvedValue([milestone]),
    });
    const useCase = new ListBabyMilestonesUseCase(babyRepository, milestoneRepository);

    const milestones = await useCase.execute({ babyId: 'baby-1', requestingUserId: 'owner-id' });

    expect(milestoneRepository.findAllByBabyId).toHaveBeenCalledWith('baby-1');
    expect(milestones).toEqual([milestone]);
  });

  it("rejects listing another user's baby milestones", async () => {
    const babyRepository = buildBabyRepository();
    const useCase = new ListBabyMilestonesUseCase(babyRepository, buildMilestoneRepository());

    await expect(useCase.execute({ babyId: 'baby-1', requestingUserId: 'intruder-id' })).rejects.toThrow(
      BabyNotFoundError,
    );
  });
});
