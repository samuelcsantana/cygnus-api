import { BabyVaccineRecord } from '../../domain/vaccine/baby-vaccine-record';

export interface BabyVaccineRecordRepository {
  findById(id: string): Promise<BabyVaccineRecord | null>;
  findAllByBabyId(babyId: string): Promise<BabyVaccineRecord[]>;
  findByBabyAndVaccine(babyId: string, vaccineId: string): Promise<BabyVaccineRecord | null>;
  save(record: BabyVaccineRecord): Promise<void>;
  /** Adhoc (CAMPAIGN/CUSTOM) records are always new rows — unlike `save`, never an upsert keyed on vaccineId. */
  create(record: BabyVaccineRecord): Promise<void>;
  delete(id: string): Promise<void>;
}
