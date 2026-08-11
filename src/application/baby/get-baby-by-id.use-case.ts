import { Baby } from '../../domain/baby/baby';
import { BabyRepository } from './baby-repository';
import { BabyGuardianRepository } from './baby-guardian-repository';
import { ensureBabyAccess } from './ensure-baby-access';

export interface GetBabyByIdInput {
  babyId: string;
  requestingUserId: string;
}

export class GetBabyByIdUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
  ) {}

  async execute(input: GetBabyByIdInput): Promise<Baby> {
    return ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);
  }
}
