import { describe, expect, it } from 'vitest';
import { BabyVaccineRecord } from '../../../../src/domain/vaccine/baby-vaccine-record';

describe('BabyVaccineRecord.derive', () => {
  it('is PENDING when the due date is in the future relative to the reference date', () => {
    const record = BabyVaccineRecord.derive({
      id: 'record-1',
      babyId: 'baby-1',
      vaccineId: 'vaccine-1',
      dueDate: new Date('2024-06-10T00:00:00.000Z'),
      referenceDate: new Date('2024-06-01T12:00:00.000Z'),
    });

    expect(record.status).toBe('PENDING');
    expect(record.applicationDate).toBeNull();
  });

  it('is PENDING when the due date is today, even later in the day', () => {
    const record = BabyVaccineRecord.derive({
      id: 'record-1',
      babyId: 'baby-1',
      vaccineId: 'vaccine-1',
      dueDate: new Date('2024-06-10T00:00:00.000Z'),
      referenceDate: new Date('2024-06-10T23:59:59.000Z'),
    });

    expect(record.status).toBe('PENDING');
  });

  it('is DELAYED when the due date is before the reference date', () => {
    const record = BabyVaccineRecord.derive({
      id: 'record-1',
      babyId: 'baby-1',
      vaccineId: 'vaccine-1',
      dueDate: new Date('2024-06-10T00:00:00.000Z'),
      referenceDate: new Date('2024-06-11T00:00:00.000Z'),
    });

    expect(record.status).toBe('DELAYED');
  });
});

describe('BabyVaccineRecord.markApplied', () => {
  it('is always APPLIED regardless of the due date', () => {
    const record = BabyVaccineRecord.markApplied({
      id: 'record-1',
      babyId: 'baby-1',
      vaccineId: 'vaccine-1',
      applicationDate: new Date('2024-06-01T00:00:00.000Z'),
      notes: 'No adverse reaction',
    });

    expect(record.status).toBe('APPLIED');
    expect(record.applicationDate).toEqual(new Date('2024-06-01T00:00:00.000Z'));
    expect(record.notes).toBe('No adverse reaction');
  });

  it('defaults notes to null when not provided', () => {
    const record = BabyVaccineRecord.markApplied({
      id: 'record-1',
      babyId: 'baby-1',
      vaccineId: 'vaccine-1',
      applicationDate: new Date('2024-06-01T00:00:00.000Z'),
    });

    expect(record.notes).toBeNull();
  });
});
