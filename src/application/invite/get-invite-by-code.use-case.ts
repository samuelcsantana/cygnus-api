import { BabyRepository } from '../baby/baby-repository';
import { BabyInviteRepository } from '../baby/baby-invite-repository';
import { InviteNotFoundError } from './errors/invite-not-found.error';

export interface InvitePreview {
  babyName: string;
  babyAvatarUrl: string | null;
  expired: boolean;
  alreadyUsed: boolean;
}

export class GetInviteByCodeUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyInviteRepository: BabyInviteRepository,
  ) {}

  async execute(code: string, referenceDate: Date = new Date()): Promise<InvitePreview> {
    const invite = await this.babyInviteRepository.findByCode(code);

    if (!invite) {
      throw new InviteNotFoundError();
    }

    const baby = await this.babyRepository.findById(invite.babyId);

    if (!baby) {
      throw new InviteNotFoundError();
    }

    return {
      babyName: baby.name,
      babyAvatarUrl: baby.avatarUrl,
      expired: invite.isExpired(referenceDate),
      alreadyUsed: invite.isUsed(),
    };
  }
}
