import { VaccineRepository } from '../../../application/vaccine/vaccine-repository';
import { Vaccine } from '../../../domain/vaccine/vaccine';
import { CacheClient } from '../../cache/cache-client';

const CATALOG_CACHE_KEY = 'vaccines:catalog';
const CATALOG_CACHE_TTL_SECONDS = 3600;

interface CachedVaccineProps {
  id: string;
  name: string;
  description: string;
  recommendedAgeInMonths: number;
  doseNumber: number;
}

export class CachedVaccineRepository implements VaccineRepository {
  constructor(
    private readonly inner: VaccineRepository,
    private readonly cache: CacheClient,
  ) {}

  async findAll(): Promise<Vaccine[]> {
    const cached = await this.cache.get(CATALOG_CACHE_KEY);

    if (cached) {
      const props = JSON.parse(cached) as CachedVaccineProps[];
      return props.map((vaccine) => Vaccine.create(vaccine));
    }

    const vaccines = await this.inner.findAll();
    await this.cache.set(CATALOG_CACHE_KEY, JSON.stringify(vaccines), 'EX', CATALOG_CACHE_TTL_SECONDS);

    return vaccines;
  }

  findById(id: string): Promise<Vaccine | null> {
    return this.inner.findById(id);
  }
}
