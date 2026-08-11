import { describe, expect, it } from 'vitest';
import { CreateMilestoneUseCase } from '../../../../src/application/milestone/create-milestone.use-case';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { FutureMilestoneDateError } from '../../../../src/domain/milestone/errors/future-milestone-date.error';
import { MilestoneBeforeBirthError } from '../../../../src/domain/milestone/errors/milestone-before-birth.error';
import { babyBirthDate, buildBabyRepository, buildMilestoneRepository, buildBabyGuardianRepository } from './milestone-test-helpers';

describe('CreateMilestoneUseCase', () => {
  it('records a new milestone for the owning user', async () => {
    const babyRepository = buildBabyRepository();
    const milestoneRepository = buildMilestoneRepository();
    const useCase = new CreateMilestoneUseCase(babyRepository, buildBabyGuardianRepository(), milestoneRepository);

    const milestone = await useCase.execute({
      babyId: 'baby-1',
      requestingUserId: 'owner-id',
      title: 'Primeiro sorriso',
      achievedAt: new Date('2024-03-01T00:00:00.000Z'),
      category: 'SOCIAL',
      referenceDate: new Date('2024-06-01T00:00:00.000Z'),
    });

    expect(milestone.title).toBe('Primeiro sorriso');
    expect(milestoneRepository.save).toHaveBeenCalledWith(milestone);
  });

  it("rejects recording for another user's baby", async () => {
    const babyRepository = buildBabyRepository();
    const useCase = new CreateMilestoneUseCase(babyRepository, buildBabyGuardianRepository(), buildMilestoneRepository());

    await expect(
      useCase.execute({
        babyId: 'baby-1',
        requestingUserId: 'intruder-id',
        title: 'Primeiro sorriso',
        achievedAt: new Date('2024-03-01T00:00:00.000Z'),
        category: 'SOCIAL',
        referenceDate: new Date('2024-06-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow(BabyNotFoundError);
  });

  it('rejects a future achievedAt', async () => {
    const babyRepository = buildBabyRepository();
    const milestoneRepository = buildMilestoneRepository();
    const useCase = new CreateMilestoneUseCase(babyRepository, buildBabyGuardianRepository(), milestoneRepository);

    await expect(
      useCase.execute({
        babyId: 'baby-1',
        requestingUserId: 'owner-id',
        title: 'Primeiros passos',
        achievedAt: new Date('2024-07-01T00:00:00.000Z'),
        category: 'MOTOR',
        referenceDate: new Date('2024-06-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow(FutureMilestoneDateError);

    expect(milestoneRepository.save).not.toHaveBeenCalled();
  });

  it("rejects an achievedAt before the baby's birth date", async () => {
    const babyRepository = buildBabyRepository();
    const milestoneRepository = buildMilestoneRepository();
    const useCase = new CreateMilestoneUseCase(babyRepository, buildBabyGuardianRepository(), milestoneRepository);

    await expect(
      useCase.execute({
        babyId: 'baby-1',
        requestingUserId: 'owner-id',
        title: 'Impossível',
        achievedAt: new Date(babyBirthDate.getTime() - 24 * 60 * 60 * 1000),
        category: 'OTHER',
        referenceDate: new Date('2024-06-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow(MilestoneBeforeBirthError);
  });
});
