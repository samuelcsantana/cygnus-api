import { randomUUID } from 'node:crypto';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { Specialist } from '../../domain/specialist/specialist';
import { SpecialistRepository } from './specialist-repository';
import { resolveSpecialistLinks } from './resolve-specialist-links';

export interface CreateSpecialistInput {
  requestingUserId: string;
  name: string;
  specialty?: string | null;
  phone?: string | null;
  babyIds?: string[];
  sharedWithUserIds?: string[];
}

export class CreateSpecialistUseCase {
  constructor(
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly specialistRepository: SpecialistRepository,
  ) {}

  async execute(input: CreateSpecialistInput): Promise<Specialist> {
    const links = await resolveSpecialistLinks(
      this.babyGuardianRepository,
      input.requestingUserId,
      input.babyIds,
      input.sharedWithUserIds,
    );

    const specialist = Specialist.register({
      id: randomUUID(),
      userId: input.requestingUserId,
      name: input.name,
      specialty: input.specialty,
      phone: input.phone,
      babyIds: links.babyIds,
      sharedWithUserIds: links.sharedWithUserIds,
    });

    await this.specialistRepository.save(specialist);

    return specialist;
  }
}
