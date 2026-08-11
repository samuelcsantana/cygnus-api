import { BabyInvite } from '../../domain/baby/baby-invite';

export interface BabyInviteRepository {
  findByCode(code: string): Promise<BabyInvite | null>;
  save(invite: BabyInvite): Promise<void>;
}
