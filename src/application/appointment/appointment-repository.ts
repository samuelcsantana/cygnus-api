import { Appointment } from '../../domain/appointment/appointment';

export interface AppointmentRepository {
  findById(id: string): Promise<Appointment | null>;
  findAllByBabyId(babyId: string): Promise<Appointment[]>;
  save(appointment: Appointment): Promise<void>;
}
