import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { Specialist } from '../../domain/specialist/specialist';
import { SpecialistRepository } from './specialist-repository';
import { SpecialistNotFoundError } from './errors/specialist-not-found.error';

export interface UpdateSpecialistInput {
  babyId: string;
  specialistId: string;
  requestingUserId: string;
  name?: string;
  specialty?: string | null;
  phone?: string | null;
}

export class UpdateSpecialistUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly specialistRepository: SpecialistRepository,
  ) {}

  async execute(input: UpdateSpecialistInput): Promise<Specialist> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    const existing = await this.specialistRepository.findById(input.specialistId);

    // The babyId check is not redundant with the access check above it: knowing a specialist id
    // must not be enough to reach that row through a baby the caller does happen to have access to.
    if (!existing || existing.babyId !== input.babyId) {
      throw new SpecialistNotFoundError();
    }

    const updated = Specialist.register({
      id: existing.id,
      babyId: existing.babyId,
      name: input.name ?? existing.name,
      specialty: input.specialty !== undefined ? input.specialty : existing.specialty,
      phone: input.phone !== undefined ? input.phone : existing.phone,
      createdAt: existing.createdAt,
    });

    await this.specialistRepository.save(updated);

    return updated;
  }
}
