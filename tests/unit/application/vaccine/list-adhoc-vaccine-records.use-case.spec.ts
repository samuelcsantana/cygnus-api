import { describe, expect, it, vi } from 'vitest';
import { ListAdhocVaccineRecordsUseCase } from '../../../../src/application/vaccine/list-adhoc-vaccine-records.use-case';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { BabyVaccineRecord } from '../../../../src/domain/vaccine/baby-vaccine-record';
import { buildBaby, buildBabyRepository, buildBabyVaccineRecordRepository, buildBabyGuardianRepository } from './vaccine-test-helpers';

describe('ListAdhocVaccineRecordsUseCase', () => {
  it('filters out CATALOG records and sorts by applicationDate descending', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const catalogRecord = BabyVaccineRecord.markApplied({
      id: 'catalog-1',
      babyId: baby.id,
      vaccineId: 'vaccine-1',
      applicationDate: new Date('2024-05-01T00:00:00.000Z'),
    });
    const olderCampaign = BabyVaccineRecord.registerAdhoc({
      id: 'campaign-1',
      babyId: baby.id,
      source: 'CAMPAIGN',
      customName: 'Influenza',
      applicationDate: new Date('2024-01-01T00:00:00.000Z'),
    });
    const newerCustom = BabyVaccineRecord.registerAdhoc({
      id: 'custom-1',
      babyId: baby.id,
      source: 'CUSTOM',
      customName: 'Varicela',
      applicationDate: new Date('2024-06-01T00:00:00.000Z'),
    });

    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const babyVaccineRecordRepository = buildBabyVaccineRecordRepository({
      findAllByBabyId: vi.fn().mockResolvedValue([catalogRecord, olderCampaign, newerCustom]),
    });

    const useCase = new ListAdhocVaccineRecordsUseCase(babyRepository, buildBabyGuardianRepository(), babyVaccineRecordRepository);
    const records = await useCase.execute({ babyId: baby.id, requestingUserId: 'owner-id' });

    expect(records.map((r) => r.id)).toEqual(['custom-1', 'campaign-1']);
  });

  it("rejects listing another user's baby records", async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const useCase = new ListAdhocVaccineRecordsUseCase(babyRepository, buildBabyGuardianRepository(), buildBabyVaccineRecordRepository());

    await expect(useCase.execute({ babyId: baby.id, requestingUserId: 'intruder-id' })).rejects.toThrow(
      BabyNotFoundError,
    );
  });

  it('forwards the search term to the repository', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const babyVaccineRecordRepository = buildBabyVaccineRecordRepository({
      findAllByBabyId: vi.fn().mockResolvedValue([]),
    });
    const useCase = new ListAdhocVaccineRecordsUseCase(babyRepository, buildBabyGuardianRepository(), babyVaccineRecordRepository);

    await useCase.execute({ babyId: baby.id, requestingUserId: 'owner-id', search: 'Influenza' });

    expect(babyVaccineRecordRepository.findAllByBabyId).toHaveBeenCalledWith(baby.id, 'Influenza');
  });
});
