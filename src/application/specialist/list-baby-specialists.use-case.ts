import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { Specialist } from '../../domain/specialist/specialist';
import { SpecialistRepository } from './specialist-repository';

export interface ListBabySpecialistsInput {
  babyId: string;
  requestingUserId: string;
}

export class ListBabySpecialistsUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly specialistRepository: SpecialistRepository,
  ) {}

  async execute(input: ListBabySpecialistsInput): Promise<Specialist[]> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    return this.specialistRepository.findAllByBabyId(input.babyId);
  }
}
