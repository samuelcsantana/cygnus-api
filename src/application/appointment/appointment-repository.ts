import { Appointment } from '../../domain/appointment/appointment';

export interface AppointmentRepository {
  findById(id: string): Promise<Appointment | null>;
  /**
   * When `search` is provided, restricts results to appointments whose doctorName, specialty,
   * location or reason contains it (case-insensitive). Omitting it returns every appointment,
   * unchanged from the pre-search behavior.
   */
  findAllByBabyId(babyId: string, search?: string): Promise<Appointment[]>;
  save(appointment: Appointment): Promise<void>;
}
