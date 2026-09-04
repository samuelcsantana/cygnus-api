import { describe, expect, it } from 'vitest';
import { Medication } from '../../../../src/domain/medication/medication';
import { InvalidMedicationNameError } from '../../../../src/domain/medication/errors/invalid-medication-name.error';
import { MedicationEndsBeforeItStartsError } from '../../../../src/domain/medication/errors/medication-ends-before-it-starts.error';

describe('Medication.record', () => {
  it('keeps dose and frequency exactly as the prescription wrote them', () => {
    const medication = Medication.record({
      id: 'medication-1',
      babyId: 'baby-1',
      name: '  Vitamina D  ',
      dosage: '5 gotas',
      frequency: '1x ao dia',
      startedOn: new Date('2026-01-10T00:00:00.000Z'),
    });

    expect(medication.name).toBe('Vitamina D');
    // Not parsed into a number and a unit: drops, ml, mg and half a tablet do not share a shape,
    // and a field that refuses what the prescription says is worse than one that stores it.
    expect(medication.dosage).toBe('5 gotas');
    expect(medication.frequency).toBe('1x ao dia');
  });

  it('rejects an empty name', () => {
    expect(() =>
      Medication.record({
        id: 'medication-1',
        babyId: 'baby-1',
        name: '   ',
        startedOn: new Date('2026-01-10T00:00:00.000Z'),
      }),
    ).toThrow(InvalidMedicationNameError);
  });

  it('rejects a course that ends before it starts', () => {
    expect(() =>
      Medication.record({
        id: 'medication-1',
        babyId: 'baby-1',
        name: 'Amoxicilina',
        startedOn: new Date('2026-01-10T00:00:00.000Z'),
        endedOn: new Date('2026-01-09T00:00:00.000Z'),
      }),
    ).toThrow(MedicationEndsBeforeItStartsError);
  });

  /**
   * Same-day is a real entry, not an edge case: a fever medicine given one afternoon starts and
   * ends on the same day. Rejecting it would push people into recording a lie about the dates.
   */
  it('accepts a course that starts and ends on the same day', () => {
    const medication = Medication.record({
      id: 'medication-1',
      babyId: 'baby-1',
      name: 'Dipirona',
      startedOn: new Date('2026-01-10T00:00:00.000Z'),
      endedOn: new Date('2026-01-10T00:00:00.000Z'),
    });

    expect(medication.endedOn).toEqual(new Date('2026-01-10T00:00:00.000Z'));
  });

  it('treats a blank optional field as absent rather than storing whitespace', () => {
    const medication = Medication.record({
      id: 'medication-1',
      babyId: 'baby-1',
      name: 'Vitamina D',
      startedOn: new Date('2026-01-10T00:00:00.000Z'),
      dosage: '   ',
      prescriberName: '',
    });

    expect(medication.dosage).toBeNull();
    expect(medication.prescriberName).toBeNull();
  });

  it('leaves a course with no recorded end open', () => {
    const medication = Medication.record({
      id: 'medication-1',
      babyId: 'baby-1',
      name: 'Vitamina D',
      startedOn: new Date('2026-01-10T00:00:00.000Z'),
    });

    expect(medication.endedOn).toBeNull();
  });
});
