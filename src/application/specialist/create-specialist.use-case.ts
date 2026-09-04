import { randomUUID } from 'node:crypto';
import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { Specialist } from '../../domain/specialist/specialist';
import { SpecialistRepository } from './specialist-repository';

export interface CreateSpecialistInput {
  babyId: string;
  requestingUserId: string;
  name: string;
  specialty?: string | null;
  phone?: string | null;
}

export class CreateSpecialistUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly specialistRepository: SpecialistRepository,
  ) {}

  async execute(input: CreateSpecialistInput): Promise<Specialist> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    const specialist = Specialist.register({
      id: randomUUID(),
      babyId: input.babyId,
      name: input.name,
      specialty: input.specialty,
      phone: input.phone,
    });

    await this.specialistRepository.save(specialist);

    return specialist;
  }
}
