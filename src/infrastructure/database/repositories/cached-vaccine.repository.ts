import { VaccineRepository } from '../../../application/vaccine/vaccine-repository';
import { Vaccine } from '../../../domain/vaccine/vaccine';
import { ACTIVE_VACCINE_CATALOG } from '../../../shared/config/vaccine-catalog';
import { CacheClient } from '../../cache/cache-client';

export const VACCINE_CATALOG_CACHE_KEY = `vaccines:catalog:${ACTIVE_VACCINE_CATALOG.version}`;
const CATALOG_CACHE_TTL_SECONDS = 3600;

interface CachedVaccineProps {
  id: string;
  code: string;
  name: string;
  description: string;
  guidance: string | null;
  recommendedAgeInMonths: number;
  doseNumber: number;
  recommendationKind: 'ROUTINE' | 'CONDITIONAL' | 'RECURRING';
  scheduleVersion: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}

function fromCachedProps(props: CachedVaccineProps): Vaccine {
  return Vaccine.create({
    ...props,
    effectiveFrom: new Date(props.effectiveFrom),
    effectiveTo: props.effectiveTo ? new Date(props.effectiveTo) : null,
  });
}

export class CachedVaccineRepository implements VaccineRepository {
  constructor(
    private readonly inner: VaccineRepository,
    private readonly cache: CacheClient,
  ) {}

  async findAll(): Promise<Vaccine[]> {
    const cached = await this.cache.get(VACCINE_CATALOG_CACHE_KEY);

    if (cached) {
      const props = JSON.parse(cached) as CachedVaccineProps[];
      if (props.length > 0) {
        return props.map(fromCachedProps);
      }
    }

    const vaccines = await this.inner.findAll();
    if (vaccines.length > 0) {
      await this.cache.set(VACCINE_CATALOG_CACHE_KEY, JSON.stringify(vaccines), 'EX', CATALOG_CACHE_TTL_SECONDS);
    }

    return vaccines;
  }

  findById(id: string): Promise<Vaccine | null> {
    return this.inner.findById(id);
  }
}
