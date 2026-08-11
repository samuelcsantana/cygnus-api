import { describe, expect, it, vi } from 'vitest';
import { DeleteMilestoneUseCase } from '../../../../src/application/milestone/delete-milestone.use-case';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { MilestoneNotFoundError } from '../../../../src/application/milestone/errors/milestone-not-found.error';
import { buildBaby, buildBabyRepository, buildMilestone, buildMilestoneRepository, buildBabyGuardianRepository } from './milestone-test-helpers';

describe('DeleteMilestoneUseCase', () => {
  it('deletes the milestone when the baby belongs to the requesting user', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const milestone = buildMilestone({ babyId: baby.id });
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const milestoneRepository = buildMilestoneRepository({
      findById: vi.fn().mockResolvedValue(milestone),
      delete: deleteFn,
    });
    const useCase = new DeleteMilestoneUseCase(babyRepository, buildBabyGuardianRepository(), milestoneRepository);

    await useCase.execute({ babyId: baby.id, milestoneId: milestone.id, requestingUserId: 'owner-id' });

    expect(deleteFn).toHaveBeenCalledWith(milestone.id);
  });

  it("rejects with BabyNotFoundError when the baby belongs to another user", async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const milestone = buildMilestone({ babyId: baby.id });
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const milestoneRepository = buildMilestoneRepository({
      findById: vi.fn().mockResolvedValue(milestone),
      delete: deleteFn,
    });
    const useCase = new DeleteMilestoneUseCase(babyRepository, buildBabyGuardianRepository(), milestoneRepository);

    await expect(
      useCase.execute({ babyId: baby.id, milestoneId: milestone.id, requestingUserId: 'intruder-id' }),
    ).rejects.toThrow(BabyNotFoundError);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('rejects with MilestoneNotFoundError when the milestone does not exist', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const milestoneRepository = buildMilestoneRepository({
      findById: vi.fn().mockResolvedValue(null),
      delete: deleteFn,
    });
    const useCase = new DeleteMilestoneUseCase(babyRepository, buildBabyGuardianRepository(), milestoneRepository);

    await expect(
      useCase.execute({ babyId: baby.id, milestoneId: 'missing-id', requestingUserId: 'owner-id' }),
    ).rejects.toThrow(MilestoneNotFoundError);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('rejects with MilestoneNotFoundError when the milestone belongs to a different baby', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const milestone = buildMilestone({ babyId: 'another-baby-id' });
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const milestoneRepository = buildMilestoneRepository({
      findById: vi.fn().mockResolvedValue(milestone),
      delete: deleteFn,
    });
    const useCase = new DeleteMilestoneUseCase(babyRepository, buildBabyGuardianRepository(), milestoneRepository);

    await expect(
      useCase.execute({ babyId: baby.id, milestoneId: milestone.id, requestingUserId: 'owner-id' }),
    ).rejects.toThrow(MilestoneNotFoundError);
    expect(deleteFn).not.toHaveBeenCalled();
  });
});
