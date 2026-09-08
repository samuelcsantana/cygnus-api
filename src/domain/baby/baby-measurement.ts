import { DomainError } from '../../shared/errors/domain-error';

export interface BabyMeasurement {
  id: string;
  measuredOn: Date;
  weightGrams: number | null;
  heightMillimeters: number | null;
}

export interface BabyMeasurementInput {
  measuredOn: string;
  weightGrams?: number | null;
  heightMillimeters?: number | null;
}

export class InvalidBabyMeasurementError extends DomainError {}

export function validateBabyMeasurement(measurement: BabyMeasurement, birthDate: Date): void {
  const date = measurement.measuredOn;
  if (!Number.isFinite(date.getTime()) || date < birthDate || date.toISOString().slice(0, 10) > new Date().toISOString().slice(0, 10)) {
    throw new InvalidBabyMeasurementError('Measurement date must be between birth and today');
  }
  const { weightGrams, heightMillimeters } = measurement;
  if (weightGrams === null && heightMillimeters === null) {
    throw new InvalidBabyMeasurementError('A measurement needs weight or height');
  }
  if (weightGrams !== null && (!Number.isInteger(weightGrams) || weightGrams < 100 || weightGrams > 150000)) {
    throw new InvalidBabyMeasurementError('Weight must be between 100 and 150000 grams');
  }
  if (heightMillimeters !== null && (!Number.isInteger(heightMillimeters) || heightMillimeters < 100 || heightMillimeters > 2500)) {
    throw new InvalidBabyMeasurementError('Height must be between 100 and 2500 millimeters');
  }
}
