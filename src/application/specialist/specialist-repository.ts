import { Specialist } from '../../domain/specialist/specialist';

export interface SpecialistRepository {
  findById(id: string): Promise<Specialist | null>;
  /**
   * Everything this user is allowed to see, which is the union of three sources and nothing else:
   * they created it, it is linked to a child they can reach, or it was shared with them by name.
   *
   * The union lives here rather than in a use case because only the database can answer the middle
   * one without loading every guardian row into memory.
   */
  findAllVisibleTo(userId: string): Promise<Specialist[]>;
  save(specialist: Specialist): Promise<void>;
  delete(id: string): Promise<void>;
}
