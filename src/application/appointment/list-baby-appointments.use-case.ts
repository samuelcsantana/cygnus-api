import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { Appointment } from '../../domain/appointment/appointment';
import { AppointmentRepository } from './appointment-repository';

export interface ListBabyAppointmentsInput {
  babyId: string;
  requestingUserId: string;
  search?: string;
}

export class ListBabyAppointmentsUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly appointmentRepository: AppointmentRepository,
  ) {}

  async execute(input: ListBabyAppointmentsInput): Promise<Appointment[]> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    return this.appointmentRepository.findAllByBabyId(input.babyId, input.search);
  }
}
