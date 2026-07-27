import { Baby } from '../../domain/baby/baby';
import { BabyRepository } from './baby-repository';

export class ListUserBabiesUseCase {
  constructor(private readonly babyRepository: BabyRepository) {}

  async execute(userId: string): Promise<Baby[]> {
    return this.babyRepository.findAllByUserId(userId);
  }
}
