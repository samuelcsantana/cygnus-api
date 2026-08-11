import { GuardianRole } from '../../domain/baby/baby-guardian';
import { BabyRepository } from './baby-repository';
import { BabyGuardianRepository } from './baby-guardian-repository';
import { UserRepository } from '../user/user-repository';
import { ensureBabyAccess } from './ensure-baby-access';

export interface BabyGuardianListItem {
  userId: string;
  name: string;
  email: string;
  role: GuardianRole;
  joinedAt: Date;
}

export interface ListBabyGuardiansInput {
  babyId: string;
  requestingUserId: string;
}

export class ListBabyGuardiansUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: ListBabyGuardiansInput): Promise<BabyGuardianListItem[]> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    const guardians = await this.babyGuardianRepository.findAllByBaby(input.babyId);

    const items = await Promise.all(
      guardians.map(async (guardian) => {
        const user = await this.userRepository.findById(guardian.userId);

        return user
          ? {
              userId: user.id,
              name: user.name,
              email: user.email,
              role: guardian.role,
              joinedAt: guardian.createdAt,
            }
          : null;
      }),
    );

    return items.filter((item): item is BabyGuardianListItem => item !== null);
  }
}
