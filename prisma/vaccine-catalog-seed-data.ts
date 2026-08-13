import { ACTIVE_VACCINE_CATALOG } from '../src/shared/config/vaccine-catalog';

export type VaccineRecommendationKind = 'ROUTINE' | 'CONDITIONAL' | 'RECURRING';

interface VaccineCatalogSeedEntry {
  code: string;
  name: string;
  description: string;
  guidance?: string;
  recommendedAgeInMonths: number;
  doseNumber: number;
  recommendationKind?: VaccineRecommendationKind;
  legacyMatches?: readonly { name: string; doseNumber: number }[];
}

// Source of truth: Calendário Nacional de Vacinação 2026 — Criança (0 to 9 years,
// 11 months and 29 days), published by Brazil's Ministry of Health and updated on
// 2026-07-29. Conditional and recurring recommendations are deliberately tagged so
// the application never labels them as overdue from age alone.
const CURRENT_SCHEDULE: readonly VaccineCatalogSeedEntry[] = [
  {
    code: 'birth-hepatitis-b',
    name: 'Hepatite B',
    description: 'Previne hepatite B e hepatite D.',
    guidance: 'Dose ao nascer.',
    recommendedAgeInMonths: 0,
    doseNumber: 1,
    legacyMatches: [{ name: 'Hepatite B', doseNumber: 1 }],
  },
  {
    code: 'birth-bcg',
    name: 'BCG',
    description: 'Previne formas graves e disseminadas da tuberculose e oferece proteção contra hanseníase.',
    guidance: 'Dose única ao nascer.',
    recommendedAgeInMonths: 0,
    doseNumber: 1,
    legacyMatches: [{ name: 'BCG', doseNumber: 1 }],
  },
  {
    code: '2m-penta-dose-1',
    name: 'Pentavalente (DTP/Hib/HB)',
    description: 'Previne difteria, tétano, coqueluche, infecções por Haemophilus influenzae b e hepatite B.',
    recommendedAgeInMonths: 2,
    doseNumber: 1,
    legacyMatches: [{ name: 'Pentavalente (DTP/Hib/HepB)', doseNumber: 1 }],
  },
  {
    code: '2m-vip-dose-1',
    name: 'VIP (Poliomielite inativada)',
    description: 'Previne poliomielite (paralisia infantil).',
    recommendedAgeInMonths: 2,
    doseNumber: 1,
    legacyMatches: [{ name: 'VIP (Poliomielite inativada)', doseNumber: 1 }],
  },
  {
    code: '2m-rotavirus-dose-1',
    name: 'Rotavírus humano',
    description: 'Previne doenças diarreicas agudas causadas pelo rotavírus.',
    guidance:
      'A primeira dose possui limite de idade. Confirme os prazos na unidade de saúde e na carteira de vacinação.',
    recommendedAgeInMonths: 2,
    doseNumber: 1,
    legacyMatches: [{ name: 'Rotavírus (VORH)', doseNumber: 1 }],
  },
  {
    code: '2m-pneumococcal-20-dose-1',
    name: 'Pneumocócica 20-valente',
    description: 'Previne doenças pneumocócicas invasivas.',
    recommendedAgeInMonths: 2,
    doseNumber: 1,
  },
  {
    code: '3m-meningococcal-c-dose-1',
    name: 'Meningocócica C',
    description: 'Previne doenças meningocócicas causadas pelo sorogrupo C.',
    recommendedAgeInMonths: 3,
    doseNumber: 1,
  },
  {
    code: '4m-penta-dose-2',
    name: 'Pentavalente (DTP/Hib/HB)',
    description: 'Previne difteria, tétano, coqueluche, infecções por Haemophilus influenzae b e hepatite B.',
    recommendedAgeInMonths: 4,
    doseNumber: 2,
    legacyMatches: [{ name: 'Pentavalente (DTP/Hib/HepB)', doseNumber: 2 }],
  },
  {
    code: '4m-vip-dose-2',
    name: 'VIP (Poliomielite inativada)',
    description: 'Previne poliomielite (paralisia infantil).',
    recommendedAgeInMonths: 4,
    doseNumber: 2,
    legacyMatches: [{ name: 'VIP (Poliomielite inativada)', doseNumber: 2 }],
  },
  {
    code: '4m-rotavirus-dose-2',
    name: 'Rotavírus humano',
    description: 'Previne doenças diarreicas agudas causadas pelo rotavírus.',
    guidance:
      'A segunda dose possui limite de idade. Confirme os prazos na unidade de saúde e na carteira de vacinação.',
    recommendedAgeInMonths: 4,
    doseNumber: 2,
    legacyMatches: [{ name: 'Rotavírus (VORH)', doseNumber: 2 }],
  },
  {
    code: '4m-pneumococcal-10-dose-2',
    name: 'Pneumocócica 10-valente',
    description: 'Previne doenças pneumocócicas invasivas pelos sorotipos contidos na vacina.',
    recommendedAgeInMonths: 4,
    doseNumber: 2,
    legacyMatches: [{ name: 'Pneumocócica 10-valente', doseNumber: 2 }],
  },
  {
    code: '5m-meningococcal-c-dose-2',
    name: 'Meningocócica C',
    description: 'Previne doenças meningocócicas causadas pelo sorogrupo C.',
    recommendedAgeInMonths: 5,
    doseNumber: 2,
  },
  {
    code: '6m-penta-dose-3',
    name: 'Pentavalente (DTP/Hib/HB)',
    description: 'Previne difteria, tétano, coqueluche, infecções por Haemophilus influenzae b e hepatite B.',
    recommendedAgeInMonths: 6,
    doseNumber: 3,
    legacyMatches: [{ name: 'Pentavalente (DTP/Hib/HepB)', doseNumber: 3 }],
  },
  {
    code: '6m-vip-dose-3',
    name: 'VIP (Poliomielite inativada)',
    description: 'Previne poliomielite (paralisia infantil).',
    recommendedAgeInMonths: 6,
    doseNumber: 3,
    legacyMatches: [{ name: 'VIP (Poliomielite inativada)', doseNumber: 3 }],
  },
  {
    code: '6m-influenza-recurring',
    name: 'Influenza trivalente',
    description: 'Previne influenza (gripe).',
    guidance:
      'Recomendação anual dos 6 meses até menores de 6 anos. Na primeira vacinação, são duas doses com 30 dias de intervalo.',
    recommendedAgeInMonths: 6,
    doseNumber: 1,
    recommendationKind: 'RECURRING',
  },
  {
    code: '6m-covid-dose-1',
    name: 'Covid-19',
    description: 'Previne formas graves de covid-19 causadas pelo SARS-CoV-2.',
    guidance:
      'O esquema pode exigir ajustes conforme produto, histórico vacinal e condição clínica. Confirme na unidade de saúde.',
    recommendedAgeInMonths: 6,
    doseNumber: 1,
  },
  {
    code: '6m-yellow-fever-exceptional',
    name: 'Febre amarela — situação excepcional',
    description: 'Previne febre amarela.',
    guidance:
      'Dos 6 aos 8 meses, somente em situação de alto risco epidemiológico e após avaliação pelo serviço de saúde.',
    recommendedAgeInMonths: 6,
    doseNumber: 1,
    recommendationKind: 'CONDITIONAL',
  },
  {
    code: '7m-covid-dose-2',
    name: 'Covid-19',
    description: 'Previne formas graves de covid-19 causadas pelo SARS-CoV-2.',
    guidance:
      'O esquema pode exigir ajustes conforme produto, histórico vacinal e condição clínica. Confirme na unidade de saúde.',
    recommendedAgeInMonths: 7,
    doseNumber: 2,
  },
  {
    code: '9m-covid-dose-3',
    name: 'Covid-19',
    description: 'Previne formas graves de covid-19 causadas pelo SARS-CoV-2.',
    guidance:
      'O esquema pode exigir ajustes conforme produto, histórico vacinal e condição clínica. Confirme na unidade de saúde.',
    recommendedAgeInMonths: 9,
    doseNumber: 3,
  },
  {
    code: '9m-yellow-fever-dose-1',
    name: 'Febre amarela',
    description: 'Previne febre amarela.',
    guidance: 'Confirme recomendações epidemiológicas locais e situações de viagem com o serviço de saúde.',
    recommendedAgeInMonths: 9,
    doseNumber: 1,
    legacyMatches: [{ name: 'Febre Amarela', doseNumber: 1 }],
  },
  {
    code: '12m-pneumococcal-20-booster-1',
    name: 'Pneumocócica 20-valente — reforço',
    description: 'Previne doenças pneumocócicas invasivas.',
    recommendedAgeInMonths: 12,
    doseNumber: 1,
  },
  {
    code: '12m-meningococcal-acwy-dose-1',
    name: 'Meningocócica ACWY',
    description: 'Previne doenças meningocócicas causadas pelos sorogrupos A, C, W-135 e Y.',
    recommendedAgeInMonths: 12,
    doseNumber: 1,
  },
  {
    code: '12m-mmr-dose-1',
    name: 'Tríplice viral (SCR)',
    description: 'Previne sarampo, caxumba e rubéola.',
    recommendedAgeInMonths: 12,
    doseNumber: 1,
    legacyMatches: [{ name: 'Tríplice Viral (SCR)', doseNumber: 1 }],
  },
  {
    code: '15m-dtp-booster-1',
    name: 'DTP — reforço',
    description: 'Previne difteria, tétano e coqueluche.',
    recommendedAgeInMonths: 15,
    doseNumber: 1,
    legacyMatches: [{ name: 'DTP (reforço)', doseNumber: 1 }],
  },
  {
    code: '15m-vip-booster-1',
    name: 'VIP (Poliomielite inativada) — reforço',
    description: 'Previne poliomielite (paralisia infantil).',
    recommendedAgeInMonths: 15,
    doseNumber: 1,
  },
  {
    code: '15m-mmr-dose-2',
    name: 'Tríplice viral (SCR)',
    description: 'Previne sarampo, caxumba e rubéola.',
    recommendedAgeInMonths: 15,
    doseNumber: 2,
    legacyMatches: [{ name: 'Tríplice Viral (SCR)', doseNumber: 2 }],
  },
  {
    code: '15m-varicella-dose-1',
    name: 'Varicela',
    description: 'Previne varicela (catapora).',
    guidance: 'Na indisponibilidade da vacina monovalente, a vacina tetraviral pode ser utilizada.',
    recommendedAgeInMonths: 15,
    doseNumber: 1,
    legacyMatches: [{ name: 'Varicela', doseNumber: 1 }],
  },
  {
    code: '15m-hepatitis-a-dose-1',
    name: 'Hepatite A',
    description: 'Previne hepatite A.',
    recommendedAgeInMonths: 15,
    doseNumber: 1,
    legacyMatches: [{ name: 'Hepatite A', doseNumber: 1 }],
  },
  {
    code: '48m-dtp-booster-2',
    name: 'DTP — reforço',
    description: 'Previne difteria, tétano e coqueluche.',
    recommendedAgeInMonths: 48,
    doseNumber: 2,
    legacyMatches: [{ name: 'DTP (reforço)', doseNumber: 2 }],
  },
  {
    code: '48m-vip-booster-2',
    name: 'VIP (Poliomielite inativada) — reforço',
    description: 'Previne poliomielite (paralisia infantil).',
    recommendedAgeInMonths: 48,
    doseNumber: 2,
  },
  {
    code: '48m-varicella-dose-2',
    name: 'Varicela',
    description: 'Previne varicela (catapora).',
    guidance: 'Na indisponibilidade da vacina monovalente, a vacina tetraviral pode ser utilizada.',
    recommendedAgeInMonths: 48,
    doseNumber: 2,
  },
  {
    code: '48m-yellow-fever-booster-1',
    name: 'Febre amarela — reforço',
    description: 'Previne febre amarela.',
    guidance: 'Confirme recomendações epidemiológicas locais e situações de viagem com o serviço de saúde.',
    recommendedAgeInMonths: 48,
    doseNumber: 1,
  },
  {
    code: '60m-pneumococcal-20-indigenous',
    name: 'Pneumocócica 20-valente — indicação especial',
    description: 'Previne doenças pneumocócicas invasivas.',
    guidance: 'Somente para povos indígenas a partir de 5 anos sem histórico de vacina pneumocócica conjugada.',
    recommendedAgeInMonths: 60,
    doseNumber: 1,
    recommendationKind: 'CONDITIONAL',
  },
  {
    code: '108m-hpv4-dose-1',
    name: 'HPV4',
    description: 'Previne infecções causadas pelo papilomavírus humano.',
    guidance: 'Dose aos 9 anos. Em caso de atraso, a recomendação oficial contempla faixas etárias adicionais.',
    recommendedAgeInMonths: 108,
    doseNumber: 1,
    legacyMatches: [{ name: 'HPV (Papilomavírus Humano)', doseNumber: 1 }],
  },
];

const effectiveFrom = new Date(`${ACTIVE_VACCINE_CATALOG.effectiveFrom}T00:00:00.000Z`);

export const VACCINE_CATALOG_LEGACY_MATCHES = new Map(
  CURRENT_SCHEDULE.map((entry) => [entry.code, entry.legacyMatches ?? []] as const),
);

export const VACCINE_CATALOG_SEED = CURRENT_SCHEDULE.map(({ legacyMatches: _legacyMatches, ...entry }) => ({
  ...entry,
  guidance: entry.guidance ?? null,
  recommendationKind: entry.recommendationKind ?? ('ROUTINE' as const),
  scheduleVersion: ACTIVE_VACCINE_CATALOG.version,
  effectiveFrom,
  effectiveTo: null,
  isActive: true,
}));
