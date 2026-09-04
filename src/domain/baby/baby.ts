import { FutureBirthDateError } from './errors/future-birth-date.error';
import { InvalidBabyNameError } from './errors/invalid-baby-name.error';

export type BabyGender = 'MALE' | 'FEMALE';

export interface BabyProps {
  id: string;
  userId: string;
  name: string;
  birthDate: Date;
  gender: BabyGender;
  bloodType: string | null;
  allergies: string[];
  healthPlanName: string | null;
  healthPlanNumber: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
  createdAt: Date;
}

export interface CreateBabyProps {
  id: string;
  userId: string;
  name: string;
  birthDate: Date;
  gender: BabyGender;
  bloodType?: string | null;
  allergies?: string[];
  healthPlanName?: string | null;
  healthPlanNumber?: string | null;
  avatarUrl?: string | null;
  avatarColor?: string | null;
  createdAt?: Date;
}

export class Baby {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly birthDate: Date;
  readonly gender: BabyGender;
  readonly bloodType: string | null;
  readonly allergies: string[];
  readonly healthPlanName: string | null;
  readonly healthPlanNumber: string | null;
  readonly avatarUrl: string | null;
  readonly avatarColor: string | null;
  readonly createdAt: Date;

  private constructor(props: BabyProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.name = props.name;
    this.birthDate = props.birthDate;
    this.gender = props.gender;
    this.bloodType = props.bloodType;
    this.allergies = props.allergies;
    this.healthPlanName = props.healthPlanName;
    this.healthPlanNumber = props.healthPlanNumber;
    this.avatarUrl = props.avatarUrl;
    this.avatarColor = props.avatarColor;
    this.createdAt = props.createdAt;
  }

  static create(props: CreateBabyProps): Baby {
    const name = props.name.trim();

    if (name.length === 0) {
      throw new InvalidBabyNameError();
    }

    if (props.birthDate.getTime() > Date.now()) {
      throw new FutureBirthDateError();
    }

    return new Baby({
      id: props.id,
      userId: props.userId,
      name,
      birthDate: props.birthDate,
      gender: props.gender,
      bloodType: props.bloodType ?? null,
      allergies: props.allergies ?? [],
      healthPlanName: props.healthPlanName ?? null,
      healthPlanNumber: props.healthPlanNumber ?? null,
      avatarUrl: props.avatarUrl ?? null,
      avatarColor: props.avatarColor ?? null,
      createdAt: props.createdAt ?? new Date(),
    });
  }
}
