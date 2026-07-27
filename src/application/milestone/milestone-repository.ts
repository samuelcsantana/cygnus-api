import { Milestone } from '../../domain/milestone/milestone';

export interface MilestoneRepository {
  findById(id: string): Promise<Milestone | null>;
  findAllByBabyId(babyId: string): Promise<Milestone[]>;
  save(milestone: Milestone): Promise<void>;
}
