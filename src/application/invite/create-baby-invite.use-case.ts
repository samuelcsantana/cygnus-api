import { randomBytes, randomUUID } from 'node:crypto';
import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { BabyInvite } from '../../domain/baby/baby-invite';
import { BabyInviteRepository } from '../baby/baby-invite-repository';

const INVITE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

export interface CreateBabyInviteInput {
  babyId: string;
  requestingUserId: string;
  inviteeEmail?: string | null;
  referenceDate?: Date;
}

export class CreateBabyInviteUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly babyInviteRepository: BabyInviteRepository,
  ) {}

  async execute(input: CreateBabyInviteInput): Promise<BabyInvite> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    const referenceDate = input.referenceDate ?? new Date();

    const invite = BabyInvite.create({
      id: randomUUID(),
      babyId: input.babyId,
      code: randomBytes(16).toString('hex'),
      createdByUserId: input.requestingUserId,
      inviteeEmail: input.inviteeEmail,
      expiresAt: new Date(referenceDate.getTime() + INVITE_EXPIRATION_MS),
      createdAt: referenceDate,
    });

    await this.babyInviteRepository.save(invite);

    return invite;
  }
}
