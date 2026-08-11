import { randomUUID } from 'node:crypto';
import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { Appointment } from '../../domain/appointment/appointment';
import { AppointmentRepository } from './appointment-repository';

export interface CreateAppointmentInput {
  babyId: string;
  requestingUserId: string;
  scheduledAt: Date;
  doctorName: string;
  specialty?: string | null;
  location?: string | null;
  reason?: string | null;
  referenceDate?: Date;
}

export class CreateAppointmentUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly appointmentRepository: AppointmentRepository,
  ) {}

  async execute(input: CreateAppointmentInput): Promise<Appointment> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    const appointment = Appointment.schedule({
      id: randomUUID(),
      babyId: input.babyId,
      scheduledAt: input.scheduledAt,
      doctorName: input.doctorName,
      specialty: input.specialty,
      location: input.location,
      reason: input.reason,
      referenceDate: input.referenceDate,
    });

    await this.appointmentRepository.save(appointment);

    return appointment;
  }
}
