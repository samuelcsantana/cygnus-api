import { Baby } from '../../domain/baby/baby';
import { BabyRepository } from './baby-repository';
import { BabyNotFoundError } from './errors/baby-not-found.error';

export interface GetBabyByIdInput {
  babyId: string;
  requestingUserId: string;
}

export class GetBabyByIdUseCase {
  constructor(private readonly babyRepository: BabyRepository) {}

  async execute(input: GetBabyByIdInput): Promise<Baby> {
    const baby = await this.babyRepository.findById(input.babyId);

    if (!baby || baby.userId !== input.requestingUserId) {
      throw new BabyNotFoundError();
    }

    return baby;
  }
}
