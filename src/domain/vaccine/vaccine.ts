import { InvalidDoseNumberError } from './errors/invalid-dose-number.error';
import { InvalidRecommendedAgeError } from './errors/invalid-recommended-age.error';
import { InvalidVaccineNameError } from './errors/invalid-vaccine-name.error';

export interface VaccineProps {
  id: string;
  name: string;
  description: string;
  recommendedAgeInMonths: number;
  doseNumber: number;
}

export class Vaccine {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly recommendedAgeInMonths: number;
  readonly doseNumber: number;

  private constructor(props: VaccineProps) {
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.recommendedAgeInMonths = props.recommendedAgeInMonths;
    this.doseNumber = props.doseNumber;
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
