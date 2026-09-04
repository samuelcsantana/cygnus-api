import { describe, expect, it, vi } from 'vitest';
import { CreateSpecialistUseCase } from '../../../../src/application/specialist/create-specialist.use-case';
import { UpdateSpecialistUseCase } from '../../../../src/application/specialist/update-specialist.use-case';
import { DeleteSpecialistUseCase } from '../../../../src/application/specialist/delete-specialist.use-case';
import { SpecialistNotFoundError } from '../../../../src/application/specialist/errors/specialist-not-found.error';
import { SpecialistRepository } from '../../../../src/application/specialist/specialist-repository';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { Specialist } from '../../../../src/domain/specialist/specialist';
import { buildBabyGuardianRepository, buildBabyRepository } from '../appointment/appointment-test-helpers';

function buildSpecialist(overrides: Partial<Parameters<typeof Specialist.register>[0]> = {}): Specialist {
  return Specialist.register({
    id: 'specialist-1',
    babyId: 'baby-1',
    name: 'Dra. Fernanda Lima',
    specialty: 'Pediatria',
    phone: '+55 11 99999-0000',
    ...overrides,
  });
}

function buildSpecialistRepository(overrides: Partial<SpecialistRepository> = {}): SpecialistRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findAllByBabyId: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('CreateSpecialistUseCase', () => {
  it("refuses to save a specialist on a baby the caller cannot reach", async () => {
    const specialistRepository = buildSpecialistRepository();
    const useCase = new CreateSpecialistUseCase(
      buildBabyRepository(),
      buildBabyGuardianRepository(),
      specialistRepository,
    );

    await expect(
      useCase.execute({ babyId: 'baby-1', requestingUserId: 'intruder-id', name: 'Dra. Fernanda Lima' }),
    ).rejects.toThrow(BabyNotFoundError);

    expect(specialistRepository.save).not.toHaveBeenCalled();
  });
});

describe('UpdateSpecialistUseCase', () => {
  it('changes only the field it was given', async () => {
    const specialistRepository = buildSpecialistRepository({
      findById: vi.fn().mockResolvedValue(buildSpecialist()),
    });
    const useCase = new UpdateSpecialistUseCase(
      buildBabyRepository(),
      buildBabyGuardianRepository(),
      specialistRepository,
    );

    const updated = await useCase.execute({
      babyId: 'baby-1',
      specialistId: 'specialist-1',
      requestingUserId: 'owner-id',
      phone: '+55 11 98888-1111',
    });

    expect(updated.phone).toBe('+55 11 98888-1111');
    expect(updated.name).toBe('Dra. Fernanda Lima');
    expect(updated.specialty).toBe('Pediatria');
  });

  /**
   * Knowing a specialist id must not be enough to reach that row through a different baby — even
   * one the caller does have access to. This is the check that the access guard above it cannot
   * make, because that guard only answers "may you touch this baby".
   */
  it('refuses a specialist that belongs to another baby', async () => {
    const specialistRepository = buildSpecialistRepository({
      findById: vi.fn().mockResolvedValue(buildSpecialist({ babyId: 'another-baby' })),
    });
    const useCase = new UpdateSpecialistUseCase(
      buildBabyRepository(),
      buildBabyGuardianRepository(),
      specialistRepository,
    );

    await expect(
      useCase.execute({
        babyId: 'baby-1',
        specialistId: 'specialist-1',
        requestingUserId: 'owner-id',
        phone: '+55 11 98888-1111',
      }),
    ).rejects.toThrow(SpecialistNotFoundError);

    expect(specialistRepository.save).not.toHaveBeenCalled();
  });
});

describe('DeleteSpecialistUseCase', () => {
  it('deletes the specialist and nothing else', async () => {
    const specialistRepository = buildSpecialistRepository({
      findById: vi.fn().mockResolvedValue(buildSpecialist()),
    });
    const useCase = new DeleteSpecialistUseCase(
      buildBabyRepository(),
      buildBabyGuardianRepository(),
      specialistRepository,
    );

    await useCase.execute({ babyId: 'baby-1', specialistId: 'specialist-1', requestingUserId: 'owner-id' });

    expect(specialistRepository.delete).toHaveBeenCalledWith('specialist-1');
  });

  it('refuses a specialist that does not exist', async () => {
    const specialistRepository = buildSpecialistRepository();
    const useCase = new DeleteSpecialistUseCase(
      buildBabyRepository(),
      buildBabyGuardianRepository(),
      specialistRepository,
    );

    await expect(
      useCase.execute({ babyId: 'baby-1', specialistId: 'missing', requestingUserId: 'owner-id' }),
    ).rejects.toThrow(SpecialistNotFoundError);

    expect(specialistRepository.delete).not.toHaveBeenCalled();
  });
});
