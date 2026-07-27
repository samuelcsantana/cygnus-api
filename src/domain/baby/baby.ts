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
  avatarUrl: string | null;
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
  avatarUrl?: string | null;
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
  readonly avatarUrl: string | null;
  readonly createdAt: Date;

  private constructor(props: BabyProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.name = props.name;
    this.birthDate = props.birthDate;
    this.gender = props.gender;
    this.bloodType = props.bloodType;
    this.allergies = props.allergies;
    this.avatarUrl = props.avatarUrl;
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
      avatarUrl: props.avatarUrl ?? null,
      createdAt: props.createdAt ?? new Date(),
    });
  }
}
