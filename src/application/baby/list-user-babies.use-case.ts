import { Baby } from '../../domain/baby/baby';
import { BabyRepository } from './baby-repository';
import { BabyGuardianRepository } from './baby-guardian-repository';

export class ListUserBabiesUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
  ) {}

  async execute(userId: string): Promise<Baby[]> {
    const guardianships = await this.babyGuardianRepository.findAllByUser(userId);

    const babies = await Promise.all(
      guardianships.map((guardianship) => this.babyRepository.findById(guardianship.babyId)),
    );

    return babies.filter((baby): baby is Baby => baby !== null);
  }
}
