import { BabyRepository } from './baby-repository';
import { BabyNotFoundError } from './errors/baby-not-found.error';

export interface DeleteBabyInput {
  babyId: string;
  requestingUserId: string;
}

export class DeleteBabyUseCase {
  constructor(private readonly babyRepository: BabyRepository) {}

  async execute(input: DeleteBabyInput): Promise<void> {
    const existingBaby = await this.babyRepository.findById(input.babyId);

    if (!existingBaby || existingBaby.userId !== input.requestingUserId) {
      throw new BabyNotFoundError();
    }

    await this.babyRepository.delete(input.babyId);
  }
}
