import { BabyVaccineRecord } from '../../domain/vaccine/baby-vaccine-record';

export interface BabyVaccineRecordRepository {
  findById(id: string): Promise<BabyVaccineRecord | null>;
  /**
   * When `search` is provided, restricts results to records whose customName contains it
   * (case-insensitive) — catalog records never have a customName, so they're naturally excluded
   * whenever a search is supplied. Omitting `search` returns every record, unchanged from the
   * pre-search behavior.
   */
  findAllByBabyId(babyId: string, search?: string): Promise<BabyVaccineRecord[]>;
  findByBabyAndVaccine(babyId: string, vaccineId: string): Promise<BabyVaccineRecord | null>;
  save(record: BabyVaccineRecord): Promise<void>;
  /** Adhoc (CAMPAIGN/CUSTOM) records are always new rows — unlike `save`, never an upsert keyed on vaccineId. */
  create(record: BabyVaccineRecord): Promise<void>;
  delete(id: string): Promise<void>;
}
