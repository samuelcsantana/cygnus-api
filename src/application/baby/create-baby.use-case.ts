import { randomUUID } from 'node:crypto';
import { Baby, BabyGender } from '../../domain/baby/baby';
import { BabyRepository } from './baby-repository';
import { BabyGuardianRepository } from './baby-guardian-repository';

export interface CreateBabyInput {
  userId: string;
  name: string;
  birthDate: Date;
  gender: BabyGender;
  bloodType?: string | null;
  allergies?: string[];
  avatarUrl?: string | null;
  avatarColor?: string | null;
}

export class CreateBabyUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
  ) {}

  async execute(input: CreateBabyInput): Promise<Baby> {
    const baby = Baby.create({
      id: randomUUID(),
      userId: input.userId,
      name: input.name,
      birthDate: input.birthDate,
      gender: input.gender,
      bloodType: input.bloodType,
      allergies: input.allergies,
      avatarUrl: input.avatarUrl,
      avatarColor: input.avatarColor,
    });

    await this.babyRepository.save(baby);
    // The creator becomes the OWNER guardian — without this row, `ensureBabyAccess` would lock
    // the creator out of the baby they just made, since access is now guardian-driven, not
    // `Baby.userId`-driven.
    await this.babyGuardianRepository.create(baby.id, input.userId, 'OWNER');

    return baby;
  }
}
