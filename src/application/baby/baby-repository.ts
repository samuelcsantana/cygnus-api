import { Baby } from '../../domain/baby/baby';

export interface BabyRepository {
  findById(id: string): Promise<Baby | null>;
  findAllByUserId(userId: string): Promise<Baby[]>;
  save(baby: Baby): Promise<void>;
}
