import { InvalidDoseNumberError } from './errors/invalid-dose-number.error';
import { InvalidRecommendedAgeError } from './errors/invalid-recommended-age.error';
import { InvalidVaccineNameError } from './errors/invalid-vaccine-name.error';

export interface VaccineProps {
  id: string;
  code: string;
  name: string;
  description: string;
  guidance: string | null;
  recommendedAgeInMonths: number;
  doseNumber: number;
  recommendationKind: VaccineRecommendationKind;
  scheduleVersion: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
}

export type VaccineRecommendationKind = 'ROUTINE' | 'CONDITIONAL' | 'RECURRING';

export class Vaccine {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly guidance: string | null;
  readonly recommendedAgeInMonths: number;
  readonly doseNumber: number;
  readonly recommendationKind: VaccineRecommendationKind;
  readonly scheduleVersion: string;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
  readonly isActive: boolean;

  private constructor(props: VaccineProps) {
    this.id = props.id;
    this.code = props.code;
    this.name = props.name;
    this.description = props.description;
    this.guidance = props.guidance;
    this.recommendedAgeInMonths = props.recommendedAgeInMonths;
    this.doseNumber = props.doseNumber;
    this.recommendationKind = props.recommendationKind;
    this.scheduleVersion = props.scheduleVersion;
    this.effectiveFrom = props.effectiveFrom;
    this.effectiveTo = props.effectiveTo;
    this.isActive = props.isActive;
  }

  static create(props: VaccineProps): Vaccine {
    const name = props.name.trim();

    if (name.length === 0) {
      throw new InvalidVaccineNameError();
    }

    if (props.recommendedAgeInMonths < 0) {
      throw new InvalidRecommendedAgeError();
    }

    if (props.doseNumber < 1) {
      throw new InvalidDoseNumberError();
    }

    return new Vaccine({ ...props, name });
  }
}
