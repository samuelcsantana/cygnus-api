export const ACTIVE_VACCINE_CATALOG = {
  version: 'PNI-2026-CHILD-2026-07-29',
  sourceName: 'Calendário Nacional de Vacinação 2026 — Criança',
  sourceOrganization: 'Ministério da Saúde do Brasil',
  sourceUrl:
    'https://www.gov.br/saude/pt-br/vacinacao/arquivos/calendario-nacional-de-vacinacao-crianca/view',
  sourceUpdatedAt: '2026-07-29',
  effectiveFrom: '2026-07-29',
  minimumAgeInMonths: 0,
  maximumAgeInMonths: 119,
} as const;

export type ActiveVaccineCatalog = typeof ACTIVE_VACCINE_CATALOG;
