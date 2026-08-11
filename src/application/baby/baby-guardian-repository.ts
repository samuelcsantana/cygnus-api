import { BabyGuardian, GuardianRole } from '../../domain/baby/baby-guardian';

export interface BabyGuardianRepository {
  findByBabyAndUser(babyId: string, userId: string): Promise<BabyGuardian | null>;
  findAllByBaby(babyId: string): Promise<BabyGuardian[]>;
  findAllByUser(userId: string): Promise<BabyGuardian[]>;
  create(babyId: string, userId: string, role?: GuardianRole): Promise<BabyGuardian>;
  delete(babyId: string, userId: string): Promise<void>;
}
