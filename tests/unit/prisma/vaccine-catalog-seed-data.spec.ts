import { describe, expect, it } from 'vitest';
import {
  VACCINE_CATALOG_LEGACY_MATCHES,
  VACCINE_CATALOG_SEED,
} from '../../../prisma/vaccine-catalog-seed-data';
import { ACTIVE_VACCINE_CATALOG } from '../../../src/shared/config/vaccine-catalog';

describe('2026 child vaccine catalog seed', () => {
  it('uses one explicit official source and effective version for every entry', () => {
    expect(ACTIVE_VACCINE_CATALOG).toMatchObject({
      version: 'PNI-2026-CHILD-2026-07-29',
      sourceOrganization: 'Ministério da Saúde do Brasil',
      sourceUpdatedAt: '2026-07-29',
      maximumAgeInMonths: 119,
    });

    expect(new Set(VACCINE_CATALOG_SEED.map((entry) => entry.scheduleVersion))).toEqual(
      new Set([ACTIVE_VACCINE_CATALOG.version]),
    );
    expect(VACCINE_CATALOG_SEED.every((entry) => entry.isActive && entry.effectiveTo === null)).toBe(true);
  });

  it('contains unique stable entry codes', () => {
    const codes = VACCINE_CATALOG_SEED.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('uses meningococcal C at 3 and 5 months and ACWY at 12 months', () => {
    const entries = VACCINE_CATALOG_SEED.filter((entry) => entry.name.startsWith('Meningocócica'));

    expect(entries.map((entry) => ({ name: entry.name, age: entry.recommendedAgeInMonths }))).toEqual([
      { name: 'Meningocócica C', age: 3 },
      { name: 'Meningocócica C', age: 5 },
      { name: 'Meningocócica ACWY', age: 12 },
    ]);
  });

  it('does not contain the discontinued oral polio vaccine', () => {
    expect(VACCINE_CATALOG_SEED.some((entry) => entry.name.includes('VOP'))).toBe(false);
    const polioEntries = VACCINE_CATALOG_SEED.filter((entry) => entry.name.includes('Poliomielite'));
    expect(polioEntries.length).toBeGreaterThan(0);
    expect(polioEntries.every((entry) => entry.name.includes('VIP'))).toBe(true);
  });

  it('tags annual and conditional recommendations to avoid automatic overdue alerts', () => {
    expect(VACCINE_CATALOG_SEED.find((entry) => entry.code === '6m-influenza-recurring')).toMatchObject({
      recommendationKind: 'RECURRING',
    });
    expect(VACCINE_CATALOG_SEED.find((entry) => entry.code === '6m-yellow-fever-exceptional')).toMatchObject({
      recommendationKind: 'CONDITIONAL',
    });
    expect(VACCINE_CATALOG_SEED.find((entry) => entry.code === '60m-pneumococcal-20-indigenous')).toMatchObject({
      recommendationKind: 'CONDITIONAL',
    });
  });

  it('only maps clinically equivalent legacy doses into the current catalog', () => {
    expect(VACCINE_CATALOG_LEGACY_MATCHES.get('12m-mmr-dose-1')).toContainEqual({
      name: 'Tríplice Viral (SCR)',
      doseNumber: 1,
    });
    expect(VACCINE_CATALOG_LEGACY_MATCHES.get('3m-meningococcal-c-dose-1')).toEqual([]);
    expect(VACCINE_CATALOG_LEGACY_MATCHES.get('15m-vip-booster-1')).toEqual([]);
  });
});
