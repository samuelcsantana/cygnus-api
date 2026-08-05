import { randomUUID } from 'node:crypto';
import { Baby, BabyGender } from '../../domain/baby/baby';
import { BabyRepository } from './baby-repository';

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
  constructor(private readonly babyRepository: BabyRepository) {}

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

    return baby;
  }
}
