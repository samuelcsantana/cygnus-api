import { describe, expect, it, vi } from 'vitest';
import { DeleteAdhocVaccineRecordUseCase } from '../../../../src/application/vaccine/delete-adhoc-vaccine-record.use-case';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { VaccineRecordNotFoundError } from '../../../../src/application/vaccine/errors/vaccine-record-not-found.error';
import { BabyVaccineRecord } from '../../../../src/domain/vaccine/baby-vaccine-record';
import { buildBaby, buildBabyRepository, buildBabyVaccineRecordRepository } from './vaccine-test-helpers';

function buildAdhocRecord(overrides: Partial<Parameters<typeof BabyVaccineRecord.registerAdhoc>[0]> = {}) {
  return BabyVaccineRecord.registerAdhoc({
    id: 'record-1',
    babyId: 'baby-1',
    source: 'CUSTOM',
    customName: 'Vacina extra',
    applicationDate: new Date('2024-06-01T00:00:00.000Z'),
    ...overrides,
  });
}

function buildCatalogRecord() {
  return BabyVaccineRecord.markApplied({
    id: 'record-catalog-1',
    babyId: 'baby-1',
    vaccineId: 'vaccine-1',
    applicationDate: new Date('2024-06-01T00:00:00.000Z'),
  });
}

describe('DeleteAdhocVaccineRecordUseCase', () => {
  it('deletes an adhoc record when it belongs to the requesting user', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const record = buildAdhocRecord({ babyId: baby.id });
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const babyVaccineRecordRepository = buildBabyVaccineRecordRepository({
      findById: vi.fn().mockResolvedValue(record),
      delete: deleteFn,
    });
    const useCase = new DeleteAdhocVaccineRecordUseCase(babyRepository, babyVaccineRecordRepository);

    await useCase.execute({ babyId: baby.id, recordId: record.id, requestingUserId: 'owner-id' });

    expect(deleteFn).toHaveBeenCalledWith(record.id);
  });

  it("rejects with BabyNotFoundError when the baby belongs to another user", async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const record = buildAdhocRecord({ babyId: baby.id });
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const babyVaccineRecordRepository = buildBabyVaccineRecordRepository({
      findById: vi.fn().mockResolvedValue(record),
      delete: deleteFn,
    });
    const useCase = new DeleteAdhocVaccineRecordUseCase(babyRepository, babyVaccineRecordRepository);

    await expect(
      useCase.execute({ babyId: baby.id, recordId: record.id, requestingUserId: 'intruder-id' }),
    ).rejects.toThrow(BabyNotFoundError);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('rejects with VaccineRecordNotFoundError when the record does not exist', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const babyVaccineRecordRepository = buildBabyVaccineRecordRepository({
      findById: vi.fn().mockResolvedValue(null),
      delete: deleteFn,
    });
    const useCase = new DeleteAdhocVaccineRecordUseCase(babyRepository, babyVaccineRecordRepository);

    await expect(
      useCase.execute({ babyId: baby.id, recordId: 'missing-id', requestingUserId: 'owner-id' }),
    ).rejects.toThrow(VaccineRecordNotFoundError);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('rejects with VaccineRecordNotFoundError for a CATALOG-sourced record', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const record = buildCatalogRecord();
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const babyVaccineRecordRepository = buildBabyVaccineRecordRepository({
      findById: vi.fn().mockResolvedValue(record),
      delete: deleteFn,
    });
    const useCase = new DeleteAdhocVaccineRecordUseCase(babyRepository, babyVaccineRecordRepository);

    await expect(
      useCase.execute({ babyId: baby.id, recordId: record.id, requestingUserId: 'owner-id' }),
    ).rejects.toThrow(VaccineRecordNotFoundError);
    expect(deleteFn).not.toHaveBeenCalled();
  });
});
