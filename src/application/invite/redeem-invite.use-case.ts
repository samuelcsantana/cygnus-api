import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { BabyInviteRepository } from '../baby/baby-invite-repository';
import { InviteNotFoundError } from './errors/invite-not-found.error';
import { InviteNoLongerValidError } from './errors/invite-no-longer-valid.error';
import { AlreadyGuardianError } from './errors/already-guardian.error';

export interface RedeemInviteInput {
  code: string;
  requestingUserId: string;
  referenceDate?: Date;
}

export interface RedeemInviteResult {
  babyId: string;
  babyName: string;
}

export class RedeemInviteUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly babyInviteRepository: BabyInviteRepository,
  ) {}

  async execute(input: RedeemInviteInput): Promise<RedeemInviteResult> {
    const invite = await this.babyInviteRepository.findByCode(input.code);

    if (!invite) {
      throw new InviteNotFoundError();
    }

    const referenceDate = input.referenceDate ?? new Date();

    if (invite.isExpired(referenceDate)) {
      throw new InviteNoLongerValidError('expired');
    }

    if (invite.isUsed()) {
      throw new InviteNoLongerValidError('already-used');
    }

    const existingGuardian = await this.babyGuardianRepository.findByBabyAndUser(invite.babyId, input.requestingUserId);

    if (existingGuardian) {
      throw new AlreadyGuardianError();
    }

    const baby = await this.babyRepository.findById(invite.babyId);

    if (!baby) {
      throw new InviteNotFoundError();
    }

    await this.babyGuardianRepository.create(invite.babyId, input.requestingUserId, 'GUARDIAN');
    await this.babyInviteRepository.save(invite.redeem(input.requestingUserId, referenceDate));

    return { babyId: invite.babyId, babyName: baby.name };
  }
}
