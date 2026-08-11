// Source: Calendário Nacional de Vacinação (Programa Nacional de Imunizações — PNI),
// Ministério da Saúde do Brasil. Ages are the standard nationwide schedule for children and
// adolescents; a handful of entries note regional/edge-case variation that a human/pediatric
// reviewer should double-check before relying on this for medical guidance (see inline comments).
export const VACCINE_CATALOG_SEED = [
  // --- Ao nascer ---
  {
    name: 'BCG',
    description: 'Protects against severe forms of tuberculosis, including miliary and meningeal TB.',
    recommendedAgeInMonths: 0,
    doseNumber: 1,
  },
  {
    name: 'Hepatite B',
    description:
      'Protects against hepatitis B virus infection. Birth dose, ideally within the first 12-24h of life; ' +
      'subsequent doses are given combined within Pentavalente at 2/4/6 months.',
    recommendedAgeInMonths: 0,
    doseNumber: 1,
  },

  // --- 2 meses ---
  {
    name: 'Pentavalente (DTP/Hib/HepB)',
    description:
      'Protects against diphtheria, tetanus, pertussis, Haemophilus influenzae type b and hepatitis B.',
    recommendedAgeInMonths: 2,
    doseNumber: 1,
  },
  {
    name: 'VIP (Poliomielite inativada)',
    description: 'Protects against poliomyelitis (polio).',
    recommendedAgeInMonths: 2,
    doseNumber: 1,
  },
  {
    name: 'Pneumocócica 10-valente',
    description: 'Protects against pneumococcal disease, including pneumonia, meningitis and otitis media.',
    recommendedAgeInMonths: 2,
    doseNumber: 1,
  },
  {
    name: 'Rotavírus (VORH)',
    description: 'Oral vaccine that protects against rotavirus gastroenteritis, a leading cause of infant diarrhea.',
    recommendedAgeInMonths: 2,
    doseNumber: 1,
  },

  // --- 3 meses ---
  {
    name: 'Meningocócica ACWY (conjugada)',
    description: 'Protects against meningococcal disease caused by serogroups A, C, W and Y.',
    recommendedAgeInMonths: 3,
    doseNumber: 1,
  },

  // --- 4 meses ---
  {
    name: 'Pentavalente (DTP/Hib/HepB)',
    description:
      'Protects against diphtheria, tetanus, pertussis, Haemophilus influenzae type b and hepatitis B.',
    recommendedAgeInMonths: 4,
    doseNumber: 2,
  },
  {
    name: 'VIP (Poliomielite inativada)',
    description: 'Protects against poliomyelitis (polio).',
    recommendedAgeInMonths: 4,
    doseNumber: 2,
  },
  {
    name: 'Pneumocócica 10-valente',
    description: 'Protects against pneumococcal disease, including pneumonia, meningitis and otitis media.',
    recommendedAgeInMonths: 4,
    doseNumber: 2,
  },
  {
    name: 'Rotavírus (VORH)',
    description: 'Oral vaccine that protects against rotavirus gastroenteritis, a leading cause of infant diarrhea.',
    recommendedAgeInMonths: 4,
    doseNumber: 2,
  },

  // --- 5 meses ---
  {
    name: 'Meningocócica ACWY (conjugada)',
    description: 'Protects against meningococcal disease caused by serogroups A, C, W and Y.',
    recommendedAgeInMonths: 5,
    doseNumber: 2,
  },

  // --- 6 meses ---
  {
    name: 'Pentavalente (DTP/Hib/HepB)',
    description:
      'Protects against diphtheria, tetanus, pertussis, Haemophilus influenzae type b and hepatitis B.',
    recommendedAgeInMonths: 6,
    doseNumber: 3,
  },
  {
    name: 'VIP (Poliomielite inativada)',
    description: 'Protects against poliomyelitis (polio).',
    recommendedAgeInMonths: 6,
    doseNumber: 3,
  },

  // --- 9 meses ---
  {
    name: 'Febre Amarela',
    description: 'Protects against yellow fever.',
    // REVIEW: current nationwide PNI schedule is a single dose at 9 months (WHO guidance since
    // 2017 treats one dose as lifelong-protective, adopted by Brazil). Some historical/regional
    // schedules for high-exposure areas used 6 months for an initial dose — confirm against the
    // current Ministério da Saúde calendar for the target region before treating this as final.
    recommendedAgeInMonths: 9,
    doseNumber: 1,
  },

  // --- 12 meses ---
  {
    name: 'Pneumocócica 10-valente',
    description: 'Booster dose, protects against pneumococcal disease, including pneumonia, meningitis and otitis media.',
    recommendedAgeInMonths: 12,
    doseNumber: 3,
  },
  {
    name: 'Meningocócica ACWY (conjugada)',
    description: 'Booster dose, protects against meningococcal disease caused by serogroups A, C, W and Y.',
    recommendedAgeInMonths: 12,
    doseNumber: 3,
  },
  {
    name: 'Tríplice Viral (SCR)',
    description: 'Protects against measles, mumps and rubella.',
    recommendedAgeInMonths: 12,
    doseNumber: 1,
  },

  // --- 15 meses ---
  {
    name: 'DTP (reforço)',
    description: 'Booster dose against diphtheria, tetanus and pertussis.',
    recommendedAgeInMonths: 15,
    doseNumber: 1,
  },
  {
    name: 'VOP (Poliomielite oral - reforço)',
    description: 'Oral booster dose against poliomyelitis (polio).',
    recommendedAgeInMonths: 15,
    doseNumber: 1,
  },
  {
    name: 'Hepatite A',
    description: 'Protects against hepatitis A virus infection. Single dose.',
    recommendedAgeInMonths: 15,
    doseNumber: 1,
  },
  {
    name: 'Tetra Viral (SCRV)',
    description:
      'Combined booster against measles, mumps, rubella and varicella, given when the 12-month Tríplice Viral ' +
      'dose was already applied — functions as both the 2nd SCR dose and the varicella dose in one shot.',
    recommendedAgeInMonths: 15,
    doseNumber: 1,
  },
  {
    name: 'Varicela',
    description:
      'Protects against varicella (chickenpox). REVIEW: usually administered as the combined Tetra Viral dose ' +
      'above rather than this monovalent formulation — kept as a separate catalog entry so a monovalent shot ' +
      'can still be logged; availability of each formulation varies by municipality.',
    recommendedAgeInMonths: 15,
    doseNumber: 1,
  },

  // --- 4 anos (48 meses) ---
  {
    name: 'DTP (reforço)',
    description: 'Second booster dose against diphtheria, tetanus and pertussis.',
    recommendedAgeInMonths: 48,
    doseNumber: 2,
  },
  {
    name: 'VOP (Poliomielite oral - reforço)',
    description: 'Second oral booster dose against poliomyelitis (polio).',
    recommendedAgeInMonths: 48,
    doseNumber: 2,
  },

  // --- 9 anos (108 meses) — earliest recommended age for HPV (9-14 anos) ---
  {
    name: 'HPV (Papilomavírus Humano)',
    description:
      'Protects against HPV-related cancers and genital warts. REVIEW: single-dose schedule for ' +
      'immunocompetent 9-14-year-olds (girls and boys) per the Ministério da Saúde 2023 update — confirm this ' +
      'is still current, as the schedule previously required 2 doses (0 and 6 months).',
    recommendedAgeInMonths: 108,
    doseNumber: 1,
  },

  // --- 11 anos (132 meses) — earliest recommended age for adolescent boosters (11-14 anos) ---
  {
    name: 'dTpa (reforço adolescente)',
    description:
      'Adolescent booster against diphtheria, tetanus and pertussis. REVIEW: recommended once between 11-14 ' +
      'years old; the PNI also recommends a dT booster every 10 years into adulthood, out of scope for this ' +
      'pediatric-focused catalog.',
    recommendedAgeInMonths: 132,
    doseNumber: 1,
  },
  {
    name: 'Meningocócica ACWY (reforço adolescente)',
    description:
      'Adolescent booster against meningococcal disease caused by serogroups A, C, W and Y. REVIEW: recommended ' +
      'once between 11-14 years old.',
    recommendedAgeInMonths: 132,
    doseNumber: 1,
  },
];
