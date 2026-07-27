import { describe, expect, it } from 'vitest';
import { CreateBabyUseCase } from '../../../../src/application/baby/create-baby.use-case';
import { FutureBirthDateError } from '../../../../src/domain/baby/errors/future-birth-date.error';
import { buildBabyRepository } from './baby-test-helpers';

describe('CreateBabyUseCase', () => {
  it('creates and persists a baby for the given user', async () => {
    const babyRepository = buildBabyRepository();
    const useCase = new CreateBabyUseCase(babyRepository);

    const baby = await useCase.execute({
      userId: 'owner-id',
      name: 'Baby Doe',
      birthDate: new Date('2024-01-15T00:00:00.000Z'),
      gender: 'FEMALE',
    });

    expect(baby.userId).toBe('owner-id');
    expect(babyRepository.save).toHaveBeenCalledWith(baby);
  });

  it('rejects a birth date in the future', async () => {
    const babyRepository = buildBabyRepository();
    const useCase = new CreateBabyUseCase(babyRepository);

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await expect(
      useCase.execute({ userId: 'owner-id', name: 'Baby Doe', birthDate: futureDate, gender: 'MALE' }),
    ).rejects.toThrow(FutureBirthDateError);

    expect(babyRepository.save).not.toHaveBeenCalled();
  });
});
