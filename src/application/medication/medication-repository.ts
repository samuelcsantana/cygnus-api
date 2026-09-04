import { Medication } from '../../domain/medication/medication';

export interface MedicationRepository {
  findById(id: string): Promise<Medication | null>;
  findAllByBabyId(babyId: string): Promise<Medication[]>;
  save(medication: Medication): Promise<void>;
  delete(id: string): Promise<void>;
}
