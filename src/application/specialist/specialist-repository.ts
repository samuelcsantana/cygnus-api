import { Specialist } from '../../domain/specialist/specialist';

export interface SpecialistRepository {
  findById(id: string): Promise<Specialist | null>;
  findAllByBabyId(babyId: string): Promise<Specialist[]>;
  save(specialist: Specialist): Promise<void>;
  delete(id: string): Promise<void>;
}
