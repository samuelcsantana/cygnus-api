import { randomUUID } from 'node:crypto';
import { Baby, BabySexAtBirth } from '../../domain/baby/baby';
import { BabyRepository } from './baby-repository';
import { BabyGuardianRepository } from './baby-guardian-repository';

export interface CreateBabyInput {
  userId: string;
  name: string;
  birthDate: Date;
  sexAtBirth?: BabySexAtBirth | null;
  bloodType?: string | null;
  allergies?: string[];
  healthPlanName?: string | null;
  healthPlanNumber?: string | null;
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
      sexAtBirth: input.sexAtBirth,
      bloodType: input.bloodType,
      allergies: input.allergies,
      healthPlanName: input.healthPlanName,
      healthPlanNumber: input.healthPlanNumber,
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
