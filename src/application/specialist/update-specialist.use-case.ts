import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { Specialist } from '../../domain/specialist/specialist';
import { SpecialistRepository } from './specialist-repository';
import { SpecialistNotFoundError } from './errors/specialist-not-found.error';
import { resolveSpecialistLinks } from './resolve-specialist-links';

export interface UpdateSpecialistInput {
  specialistId: string;
  requestingUserId: string;
  name?: string;
  specialty?: string | null;
  phone?: string | null;
  babyIds?: string[];
  sharedWithUserIds?: string[];
}

export class UpdateSpecialistUseCase {
  constructor(
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly specialistRepository: SpecialistRepository,
  ) {}

  async execute(input: UpdateSpecialistInput): Promise<Specialist> {
    const existing = await this.specialistRepository.findById(input.specialistId);

    /**
     * Only the owner edits, and the answer to "not yours" is 404 rather than 403.
     *
     * Seeing an entry — through a child, or because it was shared — does not make it yours to
     * rewrite: the phone number a co-guardian relies on should not change under them because
     * somebody else tidied their own list. A 403 would also confirm the id exists to whoever
     * guessed it.
     */
    if (!existing || existing.userId !== input.requestingUserId) {
      throw new SpecialistNotFoundError();
    }

    const links = await resolveSpecialistLinks(
      this.babyGuardianRepository,
      input.requestingUserId,
      // Absent means "leave the links alone"; an empty array means "no child", which is a real
      // answer and has to survive the difference.
      input.babyIds ?? existing.babyIds,
      input.sharedWithUserIds ?? existing.sharedWithUserIds,
    );

    const updated = Specialist.register({
      id: existing.id,
      userId: existing.userId,
      name: input.name ?? existing.name,
      specialty: input.specialty !== undefined ? input.specialty : existing.specialty,
      phone: input.phone !== undefined ? input.phone : existing.phone,
      babyIds: links.babyIds,
      sharedWithUserIds: links.sharedWithUserIds,
      createdAt: existing.createdAt,
    });

    await this.specialistRepository.save(updated);

    return updated;
  }
}
