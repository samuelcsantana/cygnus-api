import { Vaccine } from '../../domain/vaccine/vaccine';

export interface VaccineRepository {
  findAll(): Promise<Vaccine[]>;
  findById(id: string): Promise<Vaccine | null>;
}
