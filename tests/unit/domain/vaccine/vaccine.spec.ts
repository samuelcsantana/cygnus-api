import { describe, expect, it } from 'vitest';
import { Vaccine, VaccineProps } from '../../../../src/domain/vaccine/vaccine';
import { InvalidDoseNumberError } from '../../../../src/domain/vaccine/errors/invalid-dose-number.error';
import { InvalidRecommendedAgeError } from '../../../../src/domain/vaccine/errors/invalid-recommended-age.error';
import { InvalidVaccineNameError } from '../../../../src/domain/vaccine/errors/invalid-vaccine-name.error';

/**
 * The catalogue reaches Vaccine.create only through the seed, so a broken catalogue row would
 * otherwise surface as a wrong due date on a child's card. These rules are the last check.
 */
describe('Vaccine.create', () => {
  const base: VaccineProps = {
    id: 'vaccine-1',
    code: 'BCG-1',
    name: 'BCG',
    description: 'Tuberculose',
    guidance: null,
    recommendedAgeInMonths: 0,
    doseNumber: 1,
    recommendationKind: 'ROUTINE',
    scheduleVersion: 'PNI-2026',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    isActive: true,
  };

  it('trims the name and keeps an at-birth first dose', () => {
    const vaccine = Vaccine.create({ ...base, name: '  BCG  ' });

    expect(vaccine.name).toBe('BCG');
    expect(vaccine.recommendedAgeInMonths).toBe(0);
    expect(vaccine.doseNumber).toBe(1);
  });

  it('rejects a name that is only whitespace', () => {
    expect(() => Vaccine.create({ ...base, name: '   ' })).toThrow(InvalidVaccineNameError);
  });

  it('rejects a negative recommended age', () => {
    expect(() => Vaccine.create({ ...base, recommendedAgeInMonths: -1 })).toThrow(InvalidRecommendedAgeError);
  });

  it('rejects a dose numbered below 1', () => {
    expect(() => Vaccine.create({ ...base, doseNumber: 0 })).toThrow(InvalidDoseNumberError);
  });
});
