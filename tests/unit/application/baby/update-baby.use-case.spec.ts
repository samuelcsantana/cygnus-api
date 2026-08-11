import { describe, expect, it, vi } from 'vitest';
import { UpdateBabyUseCase } from '../../../../src/application/baby/update-baby.use-case';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { FutureBirthDateError } from '../../../../src/domain/baby/errors/future-birth-date.error';
import { buildBaby, buildBabyGuardianRepository, buildBabyRepository } from './baby-test-helpers';

describe('UpdateBabyUseCase', () => {
  it("updates only the provided fields for the owning user's baby", async () => {
    const baby = buildBaby({ userId: 'owner-id', name: 'Old Name' });
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const babyGuardianRepository = buildBabyGuardianRepository();
    const useCase = new UpdateBabyUseCase(babyRepository, babyGuardianRepository);

    const updated = await useCase.execute({ babyId: baby.id, requestingUserId: 'owner-id', name: 'New Name' });

    expect(updated.name).toBe('New Name');
    expect(updated.birthDate).toEqual(baby.birthDate);
    expect(babyRepository.save).toHaveBeenCalledWith(updated);
  });

  it("rejects updating another user's baby with BabyNotFoundError", async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const babyGuardianRepository = buildBabyGuardianRepository();
    const useCase = new UpdateBabyUseCase(babyRepository, babyGuardianRepository);

    await expect(
      useCase.execute({ babyId: baby.id, requestingUserId: 'intruder-id', name: 'Hacked Name' }),
    ).rejects.toThrow(BabyNotFoundError);

    expect(babyRepository.save).not.toHaveBeenCalled();
  });

  it('rejects updating the birth date to a future date', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const babyGuardianRepository = buildBabyGuardianRepository();
    const useCase = new UpdateBabyUseCase(babyRepository, babyGuardianRepository);

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await expect(
      useCase.execute({ babyId: baby.id, requestingUserId: 'owner-id', birthDate: futureDate }),
    ).rejects.toThrow(FutureBirthDateError);

    expect(babyRepository.save).not.toHaveBeenCalled();
  });
});
