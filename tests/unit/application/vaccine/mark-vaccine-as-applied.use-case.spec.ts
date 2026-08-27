import { describe, expect, it, vi } from 'vitest';
import { MarkVaccineAsAppliedUseCase } from '../../../../src/application/vaccine/mark-vaccine-as-applied.use-case';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { VaccineNotFoundError } from '../../../../src/application/vaccine/errors/vaccine-not-found.error';
import { RecurringVaccineRequiresAdhocRecordError } from '../../../../src/application/vaccine/errors/recurring-vaccine-requires-adhoc-record.error';
import { BabyVaccineRecord } from '../../../../src/domain/vaccine/baby-vaccine-record';
import {
  buildBaby,
  buildBabyGuardianRepository,
  buildBabyRepository,
  buildBabyVaccineRecordRepository,
  buildVaccine,
  buildVaccineRepository,
} from './vaccine-test-helpers';

describe('MarkVaccineAsAppliedUseCase', () => {
  it('creates a new applied record with the provided application date and notes', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const vaccine = buildVaccine();
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const vaccineRepository = buildVaccineRepository({ findById: vi.fn().mockResolvedValue(vaccine) });
    const babyVaccineRecordRepository = buildBabyVaccineRecordRepository();

    const useCase = new MarkVaccineAsAppliedUseCase(babyRepository, buildBabyGuardianRepository(), vaccineRepository, babyVaccineRecordRepository);

    const record = await useCase.execute({
      babyId: baby.id,
      vaccineId: vaccine.id,
      requestingUserId: 'owner-id',
      applicationDate: new Date('2024-02-01T00:00:00.000Z'),
      notes: 'No adverse reaction',
    });

    expect(record.status).toBe('APPLIED');
    expect(record.applicationDate).toEqual(new Date('2024-02-01T00:00:00.000Z'));
    expect(babyVaccineRecordRepository.save).toHaveBeenCalledWith(record);
  });

  it('reuses the existing record id when updating an already tracked vaccine', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const vaccine = buildVaccine();
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const vaccineRepository = buildVaccineRepository({ findById: vi.fn().mockResolvedValue(vaccine) });
    const existingRecord = BabyVaccineRecord.markApplied({
      id: 'existing-record-id',
      babyId: baby.id,
      vaccineId: vaccine.id,
      applicationDate: new Date('2024-01-15T00:00:00.000Z'),
    });
    const babyVaccineRecordRepository = buildBabyVaccineRecordRepository({
      findByBabyAndVaccine: vi.fn().mockResolvedValue(existingRecord),
    });

    const useCase = new MarkVaccineAsAppliedUseCase(babyRepository, buildBabyGuardianRepository(), vaccineRepository, babyVaccineRecordRepository);

    const record = await useCase.execute({
      babyId: baby.id,
      vaccineId: vaccine.id,
      requestingUserId: 'owner-id',
      applicationDate: new Date('2024-02-01T00:00:00.000Z'),
    });

    expect(record.id).toBe('existing-record-id');
  });

  it('stores batch number, location, professional and photo details', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const vaccine = buildVaccine();
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const vaccineRepository = buildVaccineRepository({ findById: vi.fn().mockResolvedValue(vaccine) });
    const babyVaccineRecordRepository = buildBabyVaccineRecordRepository();

    const useCase = new MarkVaccineAsAppliedUseCase(babyRepository, buildBabyGuardianRepository(), vaccineRepository, babyVaccineRecordRepository);

    const record = await useCase.execute({
      babyId: baby.id,
      vaccineId: vaccine.id,
      requestingUserId: 'owner-id',
      applicationDate: new Date('2024-02-01T00:00:00.000Z'),
      batchNumber: 'LOT-123',
      location: 'Clínica Vita',
      professional: 'Dr. Souza',
      photoUrl: 'https://example.com/photo.jpg',
    });

    expect(record.batchNumber).toBe('LOT-123');
    expect(record.location).toBe('Clínica Vita');
    expect(record.professional).toBe('Dr. Souza');
    expect(record.photoUrl).toBe('https://example.com/photo.jpg');
  });

  it("rejects marking another user's baby as vaccinated", async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const useCase = new MarkVaccineAsAppliedUseCase(
      babyRepository,
      buildBabyGuardianRepository(),
      buildVaccineRepository(),
      buildBabyVaccineRecordRepository(),
    );

    await expect(
      useCase.execute({ babyId: baby.id, vaccineId: 'vaccine-1', requestingUserId: 'intruder-id' }),
    ).rejects.toThrow(BabyNotFoundError);
  });

  it('rejects marking a vaccine that does not exist in the catalog', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const vaccineRepository = buildVaccineRepository({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new MarkVaccineAsAppliedUseCase(
      babyRepository,
      buildBabyGuardianRepository(),
      vaccineRepository,
      buildBabyVaccineRecordRepository(),
    );

    await expect(
      useCase.execute({ babyId: baby.id, vaccineId: 'missing-vaccine', requestingUserId: 'owner-id' }),
    ).rejects.toThrow(VaccineNotFoundError);
  });

  it('requires recurring vaccines to be recorded as campaign entries', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const recurringVaccine = buildVaccine({ recommendationKind: 'RECURRING' });
    const useCase = new MarkVaccineAsAppliedUseCase(
      buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) }),
      buildBabyGuardianRepository(),
      buildVaccineRepository({ findById: vi.fn().mockResolvedValue(recurringVaccine) }),
      buildBabyVaccineRecordRepository(),
    );

    await expect(
      useCase.execute({ babyId: baby.id, vaccineId: recurringVaccine.id, requestingUserId: 'owner-id' }),
    ).rejects.toThrow(RecurringVaccineRequiresAdhocRecordError);
  });
});
