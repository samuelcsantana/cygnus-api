import { describe, expect, it } from 'vitest';
import {
  BabyMeasurement,
  InvalidBabyMeasurementError,
  validateBabyMeasurement,
} from '../../../../src/domain/baby/baby-measurement';

/**
 * The HTTP schema checks the same ranges, so these rules are what holds when a measurement arrives
 * by another path (an appointment's measurements, the demo dataset, a future import). They are
 * the raw material of a growth curve: one wrong unit puts a point off the chart.
 */
describe('validateBabyMeasurement', () => {
  const birthDate = new Date('2024-03-10T00:00:00.000Z');
  const measurement = (overrides: Partial<BabyMeasurement>): BabyMeasurement => ({
    id: 'measurement-1',
    measuredOn: new Date('2024-04-10T00:00:00.000Z'),
    weightGrams: 4200,
    heightMillimeters: 540,
    ...overrides,
  });

  it('accepts a measurement with only one of weight or height', () => {
    expect(() => validateBabyMeasurement(measurement({ heightMillimeters: null }), birthDate)).not.toThrow();
    expect(() => validateBabyMeasurement(measurement({ weightGrams: null }), birthDate)).not.toThrow();
  });

  it('rejects a measurement with neither weight nor height', () => {
    expect(() => validateBabyMeasurement(measurement({ weightGrams: null, heightMillimeters: null }), birthDate))
      .toThrow(new InvalidBabyMeasurementError('A measurement needs weight or height'));
  });

  it.each([
    ['in kilograms instead of grams', 4.2],
    ['below 100 grams', 99],
    ['above 150 kg', 150001],
  ])('rejects a weight %s', (_case, weightGrams) => {
    expect(() => validateBabyMeasurement(measurement({ weightGrams }), birthDate))
      .toThrow(new InvalidBabyMeasurementError('Weight must be between 100 and 150000 grams'));
  });

  it.each([
    ['in centimetres with a fraction', 54.5],
    ['below 100 millimetres', 99],
    ['above 2.5 metres', 2501],
  ])('rejects a height %s', (_case, heightMillimeters) => {
    expect(() => validateBabyMeasurement(measurement({ heightMillimeters }), birthDate))
      .toThrow(new InvalidBabyMeasurementError('Height must be between 100 and 2500 millimeters'));
  });
});
