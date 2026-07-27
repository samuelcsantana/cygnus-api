import { BabyVaccineRecord } from '../../domain/vaccine/baby-vaccine-record';

export interface BabyVaccineRecordRepository {
  findAllByBabyId(babyId: string): Promise<BabyVaccineRecord[]>;
  findByBabyAndVaccine(babyId: string, vaccineId: string): Promise<BabyVaccineRecord | null>;
  save(record: BabyVaccineRecord): Promise<void>;
}
