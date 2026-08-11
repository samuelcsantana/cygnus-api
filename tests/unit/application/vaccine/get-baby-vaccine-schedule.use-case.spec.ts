import { describe, expect, it, vi } from 'vitest';
import { GetBabyVaccineScheduleUseCase } from '../../../../src/application/vaccine/get-baby-vaccine-schedule.use-case';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { BabyVaccineRecord } from '../../../../src/domain/vaccine/baby-vaccine-record';
import {
  buildBaby,
  buildBabyGuardianRepository,
  buildBabyRepository,
  buildBabyVaccineRecordRepository,
  buildVaccine,
  buildVaccineRepository,
} from './vaccine-test-helpers';

const birthDate = new Date('2024-01-01T00:00:00.000Z');

describe('GetBabyVaccineScheduleUseCase', () => {
  it('marks vaccines due before the reference date as DELAYED and future ones as PENDING', async () => {
    const baby = buildBaby({ birthDate, userId: 'owner-id' });
    const dueAtBirth = buildVaccine({ id: 'vaccine-birth', recommendedAgeInMonths: 0 });
    const dueAtTwoMonths = buildVaccine({ id: 'vaccine-2m', recommendedAgeInMonths: 2 });
    const dueAtSixMonths = buildVaccine({ id: 'vaccine-6m', recommendedAgeInMonths: 6 });

    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const vaccineRepository = buildVaccineRepository({
      findAll: vi.fn().mockResolvedValue([dueAtBirth, dueAtTwoMonths, dueAtSixMonths]),
    });
    const babyVaccineRecordRepository = buildBabyVaccineRecordRepository();

    const useCase = new GetBabyVaccineScheduleUseCase(babyRepository, buildBabyGuardianRepository(), vaccineRepository, babyVaccineRecordRepository);

    const schedule = await useCase.execute({
      babyId: baby.id,
      requestingUserId: 'owner-id',
      referenceDate: new Date('2024-04-01T00:00:00.000Z'),
    });

    const flatItems = schedule.flatMap((group) => group.items);
    expect(flatItems.find((item) => item.vaccineId === 'vaccine-birth')?.status).toBe('DELAYED');
    expect(flatItems.find((item) => item.vaccineId === 'vaccine-2m')?.status).toBe('DELAYED');
    expect(flatItems.find((item) => item.vaccineId === 'vaccine-6m')?.status).toBe('PENDING');
  });

  it('marks an applied vaccine as APPLIED even if its due date is in the past', async () => {
    const baby = buildBaby({ birthDate, userId: 'owner-id' });
    const vaccine = buildVaccine({ id: 'vaccine-birth', recommendedAgeInMonths: 0 });
    const appliedRecord = BabyVaccineRecord.markApplied({
      id: 'record-1',
      babyId: baby.id,
      vaccineId: vaccine.id,
      applicationDate: new Date('2024-01-02T00:00:00.000Z'),
      notes: 'Applied at the maternity ward',
    });

    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const vaccineRepository = buildVaccineRepository({ findAll: vi.fn().mockResolvedValue([vaccine]) });
    const babyVaccineRecordRepository = buildBabyVaccineRecordRepository({
      findAllByBabyId: vi.fn().mockResolvedValue([appliedRecord]),
    });

    const useCase = new GetBabyVaccineScheduleUseCase(babyRepository, buildBabyGuardianRepository(), vaccineRepository, babyVaccineRecordRepository);

    const schedule = await useCase.execute({
      babyId: baby.id,
      requestingUserId: 'owner-id',
      referenceDate: new Date('2024-06-01T00:00:00.000Z'),
    });

    const item = schedule.flatMap((group) => group.items)[0];
    expect(item.status).toBe('APPLIED');
    expect(item.applicationDate).toEqual(new Date('2024-01-02T00:00:00.000Z'));
    expect(item.notes).toBe('Applied at the maternity ward');
  });

  it('groups the schedule by age in months, sorted ascending', async () => {
    const baby = buildBaby({ birthDate, userId: 'owner-id' });
    const olderVaccine = buildVaccine({ id: 'vaccine-6m', recommendedAgeInMonths: 6 });
    const youngerVaccine = buildVaccine({ id: 'vaccine-0m', recommendedAgeInMonths: 0 });

    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const vaccineRepository = buildVaccineRepository({
      findAll: vi.fn().mockResolvedValue([olderVaccine, youngerVaccine]),
    });
    const babyVaccineRecordRepository = buildBabyVaccineRecordRepository();

    const useCase = new GetBabyVaccineScheduleUseCase(babyRepository, buildBabyGuardianRepository(), vaccineRepository, babyVaccineRecordRepository);

    const schedule = await useCase.execute({ babyId: baby.id, requestingUserId: 'owner-id' });

    expect(schedule.map((group) => group.ageInMonths)).toEqual([0, 6]);
  });

  it("rejects with BabyNotFoundError when the baby belongs to another user", async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const useCase = new GetBabyVaccineScheduleUseCase(
      babyRepository,
      buildBabyGuardianRepository(),
      buildVaccineRepository(),
      buildBabyVaccineRecordRepository(),
    );

    await expect(useCase.execute({ babyId: baby.id, requestingUserId: 'intruder-id' })).rejects.toThrow(
      BabyNotFoundError,
    );
  });

  it('rejects with BabyNotFoundError when the baby does not exist', async () => {
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new GetBabyVaccineScheduleUseCase(
      babyRepository,
      buildBabyGuardianRepository(),
      buildVaccineRepository(),
      buildBabyVaccineRecordRepository(),
    );

    await expect(useCase.execute({ babyId: 'missing-id', requestingUserId: 'owner-id' })).rejects.toThrow(
      BabyNotFoundError,
    );
  });
});
