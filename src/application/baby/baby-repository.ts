import { Baby } from '../../domain/baby/baby';

export interface BabyRepository {
  findById(id: string): Promise<Baby | null>;
  findAllByUserId(userId: string): Promise<Baby[]>;
  findAll(): Promise<Baby[]>;
  save(baby: Baby): Promise<void>;
  delete(id: string): Promise<void>;
}
