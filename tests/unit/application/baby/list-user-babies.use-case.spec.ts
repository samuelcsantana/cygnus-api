import { describe, expect, it, vi } from 'vitest';
import { ListUserBabiesUseCase } from '../../../../src/application/baby/list-user-babies.use-case';
import { buildBaby, buildBabyRepository } from './baby-test-helpers';

describe('ListUserBabiesUseCase', () => {
  it("returns only the requesting user's babies", async () => {
    const ownerBaby = buildBaby({ userId: 'owner-id', id: 'baby-1' });
    const babyRepository = buildBabyRepository({ findAllByUserId: vi.fn().mockResolvedValue([ownerBaby]) });
    const useCase = new ListUserBabiesUseCase(babyRepository);

    const babies = await useCase.execute('owner-id');

    expect(babyRepository.findAllByUserId).toHaveBeenCalledWith('owner-id');
    expect(babies).toEqual([ownerBaby]);
  });
});
