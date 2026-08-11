import { describe, expect, it, vi } from 'vitest';
import { ListUserBabiesUseCase } from '../../../../src/application/baby/list-user-babies.use-case';
import { buildBaby, buildBabyGuardian, buildBabyGuardianRepository, buildBabyRepository } from './baby-test-helpers';

describe('ListUserBabiesUseCase', () => {
  it("returns every baby the requesting user has guardian access to", async () => {
    const ownBaby = buildBaby({ userId: 'owner-id', id: 'baby-1' });
    const sharedBaby = buildBaby({ userId: 'other-user-id', id: 'baby-2' });
    const guardianships = [
      buildBabyGuardian({ babyId: 'baby-1', userId: 'owner-id', role: 'OWNER' }),
      buildBabyGuardian({ babyId: 'baby-2', userId: 'owner-id', role: 'GUARDIAN' }),
    ];
    const babyRepository = buildBabyRepository({
      findById: vi.fn((id: string) => Promise.resolve(id === 'baby-1' ? ownBaby : sharedBaby)),
    });
    const babyGuardianRepository = buildBabyGuardianRepository({
      findAllByUser: vi.fn().mockResolvedValue(guardianships),
    });
    const useCase = new ListUserBabiesUseCase(babyRepository, babyGuardianRepository);

    const babies = await useCase.execute('owner-id');

    expect(babyGuardianRepository.findAllByUser).toHaveBeenCalledWith('owner-id');
    expect(babies).toEqual([ownBaby, sharedBaby]);
  });

  it('skips a guardianship whose baby no longer exists', async () => {
    const guardianships = [buildBabyGuardian({ babyId: 'orphaned-baby', userId: 'owner-id', role: 'OWNER' })];
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(null) });
    const babyGuardianRepository = buildBabyGuardianRepository({
      findAllByUser: vi.fn().mockResolvedValue(guardianships),
    });
    const useCase = new ListUserBabiesUseCase(babyRepository, babyGuardianRepository);

    const babies = await useCase.execute('owner-id');

    expect(babies).toEqual([]);
  });
});
