import { describe, expect, it, vi } from 'vitest';
import { RegisterAdhocVaccineUseCase } from '../../../../src/application/vaccine/register-adhoc-vaccine.use-case';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { InvalidCustomVaccineNameError } from '../../../../src/domain/vaccine/errors/invalid-custom-vaccine-name.error';
import { buildBaby, buildBabyRepository, buildBabyVaccineRecordRepository, buildBabyGuardianRepository } from './vaccine-test-helpers';

describe('RegisterAdhocVaccineUseCase', () => {
  it('creates a CAMPAIGN record already applied, without touching the catalog', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const babyVaccineRecordRepository = buildBabyVaccineRecordRepository();

    const useCase = new RegisterAdhocVaccineUseCase(babyRepository, buildBabyGuardianRepository(), babyVaccineRecordRepository);

    const record = await useCase.execute({
      babyId: baby.id,
      requestingUserId: 'owner-id',
      source: 'CAMPAIGN',
      customName: 'Influenza (gripe) — Campanha anual',
      applicationDate: new Date('2024-06-01T00:00:00.000Z'),
    });

    expect(record.source).toBe('CAMPAIGN');
    expect(record.status).toBe('APPLIED');
    expect(record.vaccineId).toBeNull();
    expect(babyVaccineRecordRepository.create).toHaveBeenCalledWith(record);
  });

  it('creates a CUSTOM record with the optional detail fields', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const babyVaccineRecordRepository = buildBabyVaccineRecordRepository();

    const useCase = new RegisterAdhocVaccineUseCase(babyRepository, buildBabyGuardianRepository(), babyVaccineRecordRepository);

    const record = await useCase.execute({
      babyId: baby.id,
      requestingUserId: 'owner-id',
      source: 'CUSTOM',
      customName: 'Varicela combinada (MMRV)',
      customDose: '1ª dose',
      applicationDate: new Date('2024-06-01T00:00:00.000Z'),
      location: 'Clínica Vita',
    });

    expect(record.source).toBe('CUSTOM');
    expect(record.customDose).toBe('1ª dose');
    expect(record.location).toBe('Clínica Vita');
  });

  it("rejects registering for another user's baby", async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const babyVaccineRecordRepository = buildBabyVaccineRecordRepository();
    const useCase = new RegisterAdhocVaccineUseCase(babyRepository, buildBabyGuardianRepository(), babyVaccineRecordRepository);

    await expect(
      useCase.execute({
        babyId: baby.id,
        requestingUserId: 'intruder-id',
        source: 'CAMPAIGN',
        customName: 'Influenza',
        applicationDate: new Date('2024-06-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow(BabyNotFoundError);
    expect(babyVaccineRecordRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an empty custom name', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const babyVaccineRecordRepository = buildBabyVaccineRecordRepository();
    const useCase = new RegisterAdhocVaccineUseCase(babyRepository, buildBabyGuardianRepository(), babyVaccineRecordRepository);

    await expect(
      useCase.execute({
        babyId: baby.id,
        requestingUserId: 'owner-id',
        source: 'CUSTOM',
        customName: '   ',
        applicationDate: new Date('2024-06-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow(InvalidCustomVaccineNameError);
    expect(babyVaccineRecordRepository.create).not.toHaveBeenCalled();
  });
});
