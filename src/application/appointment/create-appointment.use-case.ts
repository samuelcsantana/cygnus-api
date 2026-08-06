import { randomUUID } from 'node:crypto';
import { BabyRepository } from '../baby/baby-repository';
import { BabyNotFoundError } from '../baby/errors/baby-not-found.error';
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
    private readonly appointmentRepository: AppointmentRepository,
  ) {}

  async execute(input: CreateAppointmentInput): Promise<Appointment> {
    const baby = await this.babyRepository.findById(input.babyId);

    if (!baby || baby.userId !== input.requestingUserId) {
      throw new BabyNotFoundError();
    }

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
