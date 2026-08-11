import { Baby, BabyGender } from '../../domain/baby/baby';
import { BabyRepository } from './baby-repository';
import { BabyGuardianRepository } from './baby-guardian-repository';
import { ensureBabyAccess } from './ensure-baby-access';

export interface UpdateBabyInput {
  babyId: string;
  requestingUserId: string;
  name?: string;
  birthDate?: Date;
  gender?: BabyGender;
  bloodType?: string | null;
  allergies?: string[];
  avatarUrl?: string | null;
  avatarColor?: string | null;
}

export class UpdateBabyUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
  ) {}

  async execute(input: UpdateBabyInput): Promise<Baby> {
    const existingBaby = await ensureBabyAccess(
      this.babyRepository,
      this.babyGuardianRepository,
      input.babyId,
      input.requestingUserId,
    );

    const updatedBaby = Baby.create({
      id: existingBaby.id,
      userId: existingBaby.userId,
      name: input.name ?? existingBaby.name,
      birthDate: input.birthDate ?? existingBaby.birthDate,
      gender: input.gender ?? existingBaby.gender,
      bloodType: input.bloodType !== undefined ? input.bloodType : existingBaby.bloodType,
      allergies: input.allergies ?? existingBaby.allergies,
      avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : existingBaby.avatarUrl,
      avatarColor: input.avatarColor !== undefined ? input.avatarColor : existingBaby.avatarColor,
      createdAt: existingBaby.createdAt,
    });

    await this.babyRepository.save(updatedBaby);

    return updatedBaby;
  }
}
