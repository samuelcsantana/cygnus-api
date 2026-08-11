import { describe, expect, it, vi } from 'vitest';
import { DeleteBabyUseCase } from '../../../../src/application/baby/delete-baby.use-case';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { GuardianForbiddenError } from '../../../../src/application/baby/errors/guardian-forbidden.error';
import { buildBaby, buildBabyGuardian, buildBabyGuardianRepository, buildBabyRepository } from './baby-test-helpers';

describe('DeleteBabyUseCase', () => {
  it('deletes the baby when the requesting user is the OWNER guardian', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby), delete: deleteFn });
    const babyGuardianRepository = buildBabyGuardianRepository();
    const useCase = new DeleteBabyUseCase(babyRepository, babyGuardianRepository);

    await useCase.execute({ babyId: baby.id, requestingUserId: 'owner-id' });

    expect(deleteFn).toHaveBeenCalledWith(baby.id);
  });

  it("rejects with BabyNotFoundError when the requester isn't a guardian of the baby", async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby), delete: deleteFn });
    const babyGuardianRepository = buildBabyGuardianRepository();
    const useCase = new DeleteBabyUseCase(babyRepository, babyGuardianRepository);

    await expect(useCase.execute({ babyId: baby.id, requestingUserId: 'intruder-id' })).rejects.toThrow(
      BabyNotFoundError,
    );
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('rejects with BabyNotFoundError when the baby does not exist', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(null), delete: deleteFn });
    const babyGuardianRepository = buildBabyGuardianRepository();
    const useCase = new DeleteBabyUseCase(babyRepository, babyGuardianRepository);

    await expect(useCase.execute({ babyId: 'missing-id', requestingUserId: 'owner-id' })).rejects.toThrow(
      BabyNotFoundError,
    );
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('rejects with GuardianForbiddenError when a non-OWNER guardian tries to delete the profile', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby), delete: deleteFn });
    const babyGuardianRepository = buildBabyGuardianRepository({
      findByBabyAndUser: vi.fn().mockResolvedValue(buildBabyGuardian({ userId: 'co-parent-id', role: 'GUARDIAN' })),
    });
    const useCase = new DeleteBabyUseCase(babyRepository, babyGuardianRepository);

    await expect(useCase.execute({ babyId: baby.id, requestingUserId: 'co-parent-id' })).rejects.toThrow(
      GuardianForbiddenError,
    );
    expect(deleteFn).not.toHaveBeenCalled();
  });
});
