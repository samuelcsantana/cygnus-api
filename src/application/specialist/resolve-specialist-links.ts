import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { SpecialistBabyForbiddenError } from './errors/specialist-baby-forbidden.error';
import { SpecialistShareForbiddenError } from './errors/specialist-share-forbidden.error';

export interface ResolvedLinks {
  babyIds: string[];
  sharedWithUserIds: string[];
}

/**
 * Checks what a caller is allowed to point a professional at, before anything is written.
 *
 * Two different abuses are being closed here, and neither is exotic:
 *
 * - **Linking to somebody else's child.** The baby id is a uuid the caller supplies. Without this
 *   check, knowing one would be enough to attach an entry to a stranger's child — and, through the
 *   visibility union, to make that entry appear in that family's list.
 * - **Pushing an entry into a stranger's list.** A share is a user id, also supplied. Sharing is
 *   therefore restricted to people who already share a child with the caller: the co-guardians.
 *   That is exactly the set the interface offers, so the rule never blocks a legitimate choice.
 */
export async function resolveSpecialistLinks(
  babyGuardianRepository: BabyGuardianRepository,
  userId: string,
  babyIds: string[] | undefined,
  sharedWithUserIds: string[] | undefined,
): Promise<ResolvedLinks> {
  const wantedBabyIds = [...new Set(babyIds ?? [])];
  const wantedShares = [...new Set(sharedWithUserIds ?? [])].filter((candidate) => candidate !== userId);

  if (wantedBabyIds.length === 0 && wantedShares.length === 0) {
    return { babyIds: [], sharedWithUserIds: [] };
  }

  const ownGuardianships = await babyGuardianRepository.findAllByUser(userId);
  const reachableBabyIds = new Set(ownGuardianships.map((guardianship) => guardianship.babyId));

  const forbiddenBaby = wantedBabyIds.find((babyId) => !reachableBabyIds.has(babyId));
  if (forbiddenBaby) {
    throw new SpecialistBabyForbiddenError();
  }

  if (wantedShares.length > 0) {
    const coGuardianIds = new Set<string>();
    for (const babyId of reachableBabyIds) {
      const guardians = await babyGuardianRepository.findAllByBaby(babyId);
      for (const guardian of guardians) {
        if (guardian.userId !== userId) {
          coGuardianIds.add(guardian.userId);
        }
      }
    }

    const forbiddenShare = wantedShares.find((candidate) => !coGuardianIds.has(candidate));
    if (forbiddenShare) {
      throw new SpecialistShareForbiddenError();
    }
  }

  return { babyIds: wantedBabyIds, sharedWithUserIds: wantedShares };
}
