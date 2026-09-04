import { Baby, BabySexAtBirth } from '../../domain/baby/baby';
import { BabyRepository } from './baby-repository';
import { BabyGuardianRepository } from './baby-guardian-repository';
import { ensureBabyAccess } from './ensure-baby-access';

export interface UpdateBabyInput {
  babyId: string;
  requestingUserId: string;
  name?: string;
  birthDate?: Date;
  sexAtBirth?: BabySexAtBirth | null;
  bloodType?: string | null;
  allergies?: string[];
  healthPlanName?: string | null;
  healthPlanNumber?: string | null;
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
      sexAtBirth: input.sexAtBirth !== undefined ? input.sexAtBirth : existingBaby.sexAtBirth,
      bloodType: input.bloodType !== undefined ? input.bloodType : existingBaby.bloodType,
      allergies: input.allergies ?? existingBaby.allergies,
      healthPlanName: input.healthPlanName !== undefined ? input.healthPlanName : existingBaby.healthPlanName,
      healthPlanNumber:
        input.healthPlanNumber !== undefined ? input.healthPlanNumber : existingBaby.healthPlanNumber,
      avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : existingBaby.avatarUrl,
      avatarColor: input.avatarColor !== undefined ? input.avatarColor : existingBaby.avatarColor,
      createdAt: existingBaby.createdAt,
    });

    await this.babyRepository.save(updatedBaby);

    return updatedBaby;
  }
}
