import { describe, expect, it, vi } from 'vitest';
import { CreateSpecialistUseCase } from '../../../../src/application/specialist/create-specialist.use-case';
import { UpdateSpecialistUseCase } from '../../../../src/application/specialist/update-specialist.use-case';
import { DeleteSpecialistUseCase } from '../../../../src/application/specialist/delete-specialist.use-case';
import { ListVisibleSpecialistsUseCase } from '../../../../src/application/specialist/list-visible-specialists.use-case';
import { SpecialistNotFoundError } from '../../../../src/application/specialist/errors/specialist-not-found.error';
import { SpecialistBabyForbiddenError } from '../../../../src/application/specialist/errors/specialist-baby-forbidden.error';
import { SpecialistShareForbiddenError } from '../../../../src/application/specialist/errors/specialist-share-forbidden.error';
import { SpecialistRepository } from '../../../../src/application/specialist/specialist-repository';
import { BabyGuardianRepository } from '../../../../src/application/baby/baby-guardian-repository';
import { Specialist } from '../../../../src/domain/specialist/specialist';
import { BabyGuardian } from '../../../../src/domain/baby/baby-guardian';

const OWNER = 'owner-id';
const CO_GUARDIAN = 'co-guardian-id';
const OWN_BABY = 'baby-1';

function buildSpecialist(overrides: Partial<Parameters<typeof Specialist.register>[0]> = {}): Specialist {
  return Specialist.register({
    id: 'specialist-1',
    userId: OWNER,
    name: 'Dra. Fernanda Lima',
    specialty: 'Pediatria',
    phone: '+55 11 99999-0000',
    ...overrides,
  });
}

function buildSpecialistRepository(overrides: Partial<SpecialistRepository> = {}): SpecialistRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findAllVisibleTo: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** O dono é guardião de `baby-1`, e `co-guardian-id` divide essa mesma criança com ele. */
function buildBabyGuardianRepository(overrides: Partial<BabyGuardianRepository> = {}): BabyGuardianRepository {
  return {
    findByBabyAndUser: vi.fn().mockResolvedValue(null),
    findAllByBaby: vi.fn(async (babyId: string) =>
      babyId === OWN_BABY
        ? [
            BabyGuardian.create({ id: 'g1', babyId: OWN_BABY, userId: OWNER, role: 'OWNER' }),
            BabyGuardian.create({ id: 'g2', babyId: OWN_BABY, userId: CO_GUARDIAN, role: 'GUARDIAN' }),
          ]
        : [],
    ),
    findAllByUser: vi.fn(async (userId: string) =>
      userId === OWNER ? [BabyGuardian.create({ id: 'g1', babyId: OWN_BABY, userId: OWNER, role: 'OWNER' })] : [],
    ),
    create: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('CreateSpecialistUseCase', () => {
  it('saves an entry linked to no child at all', async () => {
    const specialistRepository = buildSpecialistRepository();
    const useCase = new CreateSpecialistUseCase(buildBabyGuardianRepository(), specialistRepository);

    const specialist = await useCase.execute({ requestingUserId: OWNER, name: 'Dra. Fernanda Lima' });

    expect(specialist.babyIds).toEqual([]);
    expect(specialist.sharedWithUserIds).toEqual([]);
    expect(specialistRepository.save).toHaveBeenCalledWith(specialist);
  });

  /**
   * O id da criança vem do cliente. Sem esta checagem, saber um uuid bastaria para pendurar uma
   * entrada na criança de um estranho e fazê-la aparecer na lista daquela família.
   */
  it("refuses a child the caller cannot reach", async () => {
    const specialistRepository = buildSpecialistRepository();
    const useCase = new CreateSpecialistUseCase(buildBabyGuardianRepository(), specialistRepository);

    await expect(
      useCase.execute({ requestingUserId: OWNER, name: 'Dra. Fernanda Lima', babyIds: ['someone-elses-baby'] }),
    ).rejects.toThrow(SpecialistBabyForbiddenError);

    expect(specialistRepository.save).not.toHaveBeenCalled();
  });

  it('shares with a co-guardian, and refuses a stranger', async () => {
    const specialistRepository = buildSpecialistRepository();
    const useCase = new CreateSpecialistUseCase(buildBabyGuardianRepository(), specialistRepository);

    const shared = await useCase.execute({
      requestingUserId: OWNER,
      name: 'Dra. Fernanda Lima',
      sharedWithUserIds: [CO_GUARDIAN],
    });
    expect(shared.sharedWithUserIds).toEqual([CO_GUARDIAN]);

    await expect(
      useCase.execute({ requestingUserId: OWNER, name: 'Dra. Fernanda Lima', sharedWithUserIds: ['stranger-id'] }),
    ).rejects.toThrow(SpecialistShareForbiddenError);
  });

  it('drops the owner from their own share list', async () => {
    const useCase = new CreateSpecialistUseCase(buildBabyGuardianRepository(), buildSpecialistRepository());

    const specialist = await useCase.execute({
      requestingUserId: OWNER,
      name: 'Dra. Fernanda Lima',
      sharedWithUserIds: [OWNER],
    });

    // Compartilhar consigo não é compartilhar, e apareceria como se outra pessoa tivesse dado
    // acesso à própria entrada.
    expect(specialist.sharedWithUserIds).toEqual([]);
  });
});

describe('ListVisibleSpecialistsUseCase', () => {
  it('narrows to one child without widening what is visible', async () => {
    const linked = buildSpecialist({ id: 'linked', name: 'Da criança', babyIds: [OWN_BABY] });
    const private_ = buildSpecialist({ id: 'private', name: 'De ninguém' });
    const useCase = new ListVisibleSpecialistsUseCase(
      buildSpecialistRepository({ findAllVisibleTo: vi.fn().mockResolvedValue([linked, private_]) }),
    );

    expect(await useCase.execute({ requestingUserId: OWNER })).toHaveLength(2);
    expect(await useCase.execute({ requestingUserId: OWNER, babyId: OWN_BABY })).toEqual([linked]);
  });
});

describe('UpdateSpecialistUseCase', () => {
  it('changes only what it was given', async () => {
    const specialistRepository = buildSpecialistRepository({
      findById: vi.fn().mockResolvedValue(buildSpecialist({ babyIds: [OWN_BABY] })),
    });
    const useCase = new UpdateSpecialistUseCase(buildBabyGuardianRepository(), specialistRepository);

    const updated = await useCase.execute({
      specialistId: 'specialist-1',
      requestingUserId: OWNER,
      phone: '+55 11 98888-1111',
    });

    expect(updated.phone).toBe('+55 11 98888-1111');
    expect(updated.name).toBe('Dra. Fernanda Lima');
    // Ausente é "não mexa nos vínculos" — e é diferente de `[]`, que é "nenhuma criança".
    expect(updated.babyIds).toEqual([OWN_BABY]);
  });

  it('unlinks every child when the list comes empty', async () => {
    const specialistRepository = buildSpecialistRepository({
      findById: vi.fn().mockResolvedValue(buildSpecialist({ babyIds: [OWN_BABY] })),
    });
    const useCase = new UpdateSpecialistUseCase(buildBabyGuardianRepository(), specialistRepository);

    const updated = await useCase.execute({
      specialistId: 'specialist-1',
      requestingUserId: OWNER,
      babyIds: [],
    });

    expect(updated.babyIds).toEqual([]);
  });

  /**
   * Enxergar não é possuir: o telefone de que a outra responsável depende não pode mudar debaixo
   * dela porque alguém arrumou a própria agenda. E 404, não 403, para não confirmar o id.
   */
  it('refuses somebody who only sees the entry', async () => {
    const specialistRepository = buildSpecialistRepository({
      findById: vi.fn().mockResolvedValue(buildSpecialist({ babyIds: [OWN_BABY] })),
    });
    const useCase = new UpdateSpecialistUseCase(buildBabyGuardianRepository(), specialistRepository);

    await expect(
      useCase.execute({ specialistId: 'specialist-1', requestingUserId: CO_GUARDIAN, phone: '+55 11 90000-0000' }),
    ).rejects.toThrow(SpecialistNotFoundError);

    expect(specialistRepository.save).not.toHaveBeenCalled();
  });
});

describe('DeleteSpecialistUseCase', () => {
  it('deletes the entry it owns', async () => {
    const specialistRepository = buildSpecialistRepository({
      findById: vi.fn().mockResolvedValue(buildSpecialist()),
    });
    const useCase = new DeleteSpecialistUseCase(specialistRepository);

    await useCase.execute({ specialistId: 'specialist-1', requestingUserId: OWNER });

    expect(specialistRepository.delete).toHaveBeenCalledWith('specialist-1');
  });

  it('refuses an entry owned by somebody else, and one that does not exist', async () => {
    const owned = buildSpecialistRepository({ findById: vi.fn().mockResolvedValue(buildSpecialist()) });
    const missing = buildSpecialistRepository();

    await expect(
      new DeleteSpecialistUseCase(owned).execute({ specialistId: 'specialist-1', requestingUserId: CO_GUARDIAN }),
    ).rejects.toThrow(SpecialistNotFoundError);

    await expect(
      new DeleteSpecialistUseCase(missing).execute({ specialistId: 'missing', requestingUserId: OWNER }),
    ).rejects.toThrow(SpecialistNotFoundError);

    expect(owned.delete).not.toHaveBeenCalled();
  });
});
