import { Baby } from '../../domain/baby/baby';
import { BabyRepository } from './baby-repository';
import { BabyGuardianRepository } from './baby-guardian-repository';
import { BabyNotFoundError } from './errors/baby-not-found.error';

// Single source of truth for "can this user touch this baby's data" — replaces the old
// `baby.userId !== requestingUserId` check now that more than one guardian can manage a baby.
// Deliberately throws the same `BabyNotFoundError` (404) whether the baby doesn't exist or the
// requester just isn't one of its guardians, so intruders can't distinguish the two cases
// (OWASP BOLA mitigation, same behavior the single-owner check had before).
export async function ensureBabyAccess(
  babyRepository: BabyRepository,
  babyGuardianRepository: BabyGuardianRepository,
  babyId: string,
  requestingUserId: string,
): Promise<Baby> {
  const baby = await babyRepository.findById(babyId);

  if (!baby) {
    throw new BabyNotFoundError();
  }

  const guardian = await babyGuardianRepository.findByBabyAndUser(babyId, requestingUserId);

  if (!guardian) {
    throw new BabyNotFoundError();
  }

  return baby;
}
