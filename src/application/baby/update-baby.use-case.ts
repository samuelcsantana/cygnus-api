import { Baby, BabyGender } from '../../domain/baby/baby';
import { BabyRepository } from './baby-repository';
import { BabyNotFoundError } from './errors/baby-not-found.error';

export interface UpdateBabyInput {
  babyId: string;
  requestingUserId: string;
  name?: string;
  birthDate?: Date;
  gender?: BabyGender;
  bloodType?: string | null;
  allergies?: string[];
  avatarUrl?: string | null;
}

export class UpdateBabyUseCase {
  constructor(private readonly babyRepository: BabyRepository) {}

  async execute(input: UpdateBabyInput): Promise<Baby> {
    const existingBaby = await this.babyRepository.findById(input.babyId);

    if (!existingBaby || existingBaby.userId !== input.requestingUserId) {
      throw new BabyNotFoundError();
    }

    const updatedBaby = Baby.create({
      id: existingBaby.id,
      userId: existingBaby.userId,
      name: input.name ?? existingBaby.name,
      birthDate: input.birthDate ?? existingBaby.birthDate,
      gender: input.gender ?? existingBaby.gender,
      bloodType: input.bloodType !== undefined ? input.bloodType : existingBaby.bloodType,
      allergies: input.allergies ?? existingBaby.allergies,
      avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : existingBaby.avatarUrl,
      createdAt: existingBaby.createdAt,
    });

    await this.babyRepository.save(updatedBaby);

    return updatedBaby;
  }
}
