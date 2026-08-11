import { describe, expect, it, vi } from 'vitest';
import { GetBabyByIdUseCase } from '../../../../src/application/baby/get-baby-by-id.use-case';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { buildBaby, buildBabyGuardianRepository, buildBabyRepository } from './baby-test-helpers';

describe('GetBabyByIdUseCase', () => {
  it("returns the baby when it belongs to the requesting user", async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const babyGuardianRepository = buildBabyGuardianRepository();
    const useCase = new GetBabyByIdUseCase(babyRepository, babyGuardianRepository);

    const result = await useCase.execute({ babyId: baby.id, requestingUserId: 'owner-id' });

    expect(result).toBe(baby);
  });

  it("rejects with BabyNotFoundError when the baby belongs to another user", async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const babyGuardianRepository = buildBabyGuardianRepository();
    const useCase = new GetBabyByIdUseCase(babyRepository, babyGuardianRepository);

    await expect(useCase.execute({ babyId: baby.id, requestingUserId: 'intruder-id' })).rejects.toThrow(
      BabyNotFoundError,
    );
  });

  it('rejects with BabyNotFoundError when the baby does not exist', async () => {
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(null) });
    const babyGuardianRepository = buildBabyGuardianRepository();
    const useCase = new GetBabyByIdUseCase(babyRepository, babyGuardianRepository);

    await expect(useCase.execute({ babyId: 'missing-id', requestingUserId: 'owner-id' })).rejects.toThrow(
      BabyNotFoundError,
    );
  });
});
