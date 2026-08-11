import { Milestone } from '../../domain/milestone/milestone';

export interface MilestoneRepository {
  findById(id: string): Promise<Milestone | null>;
  /**
   * When `search` is provided, restricts results to milestones whose title or description
   * contains it (case-insensitive). Omitting it returns every milestone, unchanged from the
   * pre-search behavior.
   */
  findAllByBabyId(babyId: string, search?: string): Promise<Milestone[]>;
  save(milestone: Milestone): Promise<void>;
  delete(id: string): Promise<void>;
}
