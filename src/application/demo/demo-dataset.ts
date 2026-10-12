import { randomUUID } from 'node:crypto';
import { AppointmentStatus } from '../../domain/appointment/appointment';
import { BabySexAtBirth } from '../../domain/baby/baby';
import { MilestoneCategory } from '../../domain/milestone/milestone';
import { User } from '../../domain/user/user';
import { Vaccine } from '../../domain/vaccine/vaccine';
import { addMonthsClamped, startOfUtcDay } from '../../shared/utils/date';

export interface DemoBaby {
  id: string;
  name: string;
  birthDate: Date;
  sexAtBirth: BabySexAtBirth;
  bloodType: string;
  allergies: string[];
  healthPlanName: string;
  healthPlanNumber: string;
  avatarColor: string;
}

export interface DemoMeasurement {
  id: string;
  babyId: string;
  measuredOn: Date;
  weightGrams: number;
  heightMillimeters: number;
}

export interface DemoVaccineRecord {
  id: string;
  babyId: string;
  vaccineId: string;
  applicationDate: Date;
  batchNumber: string;
  location: string;
  professional: string;
}

export interface DemoSpecialist {
  id: string;
  name: string;
  specialty: string;
  phone: string;
  babyIds: string[];
}

export interface DemoAppointment {
  id: string;
  babyId: string;
  specialistId: string;
  scheduledAt: Date;
  doctorName: string;
  specialty: string;
  location: string;
  reason: string;
  notes: string | null;
  status: AppointmentStatus;
  weightGrams: number | null;
  heightMillimeters: number | null;
}

export interface DemoMilestone {
  id: string;
  babyId: string;
  title: string;
  description: string | null;
  achievedAt: Date;
  category: MilestoneCategory;
}

export interface DemoMedication {
  id: string;
  babyId: string;
  name: string;
  dosage: string;
  frequency: string;
  reason: string;
  prescriberName: string;
  startedOn: Date;
  endedOn: Date | null;
  notes: string | null;
}

/** Everything one demo account starts with. Plain records: the repository writes them in one go. */
export interface DemoDataset {
  user: User;
  babies: DemoBaby[];
  measurements: DemoMeasurement[];
  vaccineRecords: DemoVaccineRecord[];
  specialists: DemoSpecialist[];
  appointments: DemoAppointment[];
  milestones: DemoMilestone[];
  medications: DemoMedication[];
}

export interface BuildDemoDatasetInput {
  now: Date;
  passwordHash: string;
  /** The active vaccine catalog. Vaccines are chosen by due date, never by code, so a new schedule version needs no change here. */
  vaccines: readonly Vaccine[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const VACCINATION_SITE = 'UBS Jardim Aurora';
const VACCINATOR = 'Enf. Juliana Prado';
const PEDIATRIC_CLINIC = 'Clínica Crescer — Pinheiros';

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** 13:00 UTC is 10:00 in São Paulo: a believable time for a clinic appointment. */
function atClinicHour(day: Date): Date {
  return new Date(startOfUtcDay(day).getTime() + 13 * 60 * 60 * 1000);
}

/**
 * The demo family: a parent, a baby of six months and a three-year-old.
 *
 * **Every date is relative to `now`.** A fixed seed would age: in a year the "baby" would be
 * eighteen months old and the upcoming appointment a year in the past. Built at click time, the
 * dashboard always opens on the same story — one vaccine overdue, a check-up in two days, a growth
 * curve, milestones — whatever day the recruiter clicks.
 *
 * Two children because the app's household view, the child selector and the per-child narrowing
 * only exist with more than one; with a single child the selector is hidden. The baby carries the
 * dense part of the PNI schedule (a dose every month or two); the toddler shows the long tail and a
 * finished course of medication.
 *
 * The text is Brazilian Portuguese, like the vaccine catalog it sits beside: the schedule is the
 * PNI's, and a demo in another language would describe a family that does not use it.
 */
export function buildDemoDataset(input: BuildDemoDatasetInput): DemoDataset {
  const today = startOfUtcDay(input.now);
  const user = User.createDemo({ id: randomUUID(), passwordHash: input.passwordHash, name: 'Marina Costa', now: input.now });

  // Six months and twenty days: the six-month doses are twenty days overdue, the seven-month dose
  // is ten days away, and the six-month check-up already has a weight on the curve.
  const helena: DemoBaby = {
    id: randomUUID(),
    name: 'Helena',
    birthDate: addDays(addMonthsClamped(today, -6), -20),
    sexAtBirth: 'FEMALE',
    bloodType: 'O+',
    allergies: [],
    healthPlanName: 'Saúde Mais',
    healthPlanNumber: '0042 7781 3390 0012',
    avatarColor: '#6950C7',
  };
  const theo: DemoBaby = {
    id: randomUUID(),
    name: 'Theo',
    birthDate: addMonthsClamped(today, -38),
    sexAtBirth: 'MALE',
    bloodType: 'A+',
    allergies: ['Amendoim'],
    healthPlanName: 'Saúde Mais',
    healthPlanNumber: '0042 7781 3390 0011',
    avatarColor: '#16745B',
  };

  const pediatrician: DemoSpecialist = {
    id: randomUUID(),
    name: 'Dra. Ana Ribeiro',
    specialty: 'Pediatria',
    // Not a number anybody holds: Brazilian subscriber numbers never start with 1.
    phone: '(11) 1234-5678',
    babyIds: [helena.id, theo.id],
  };
  const dentist: DemoSpecialist = {
    id: randomUUID(),
    name: 'Dr. Paulo Mendes',
    specialty: 'Odontopediatria',
    phone: '(11) 1234-8765',
    babyIds: [theo.id],
  };

  // WHO growth medians, rounded: a demo curve should sit where a healthy child's does.
  const helenaGrowth = [
    { months: 1, weightGrams: 4200, heightMillimeters: 537 },
    { months: 2, weightGrams: 5100, heightMillimeters: 571 },
    { months: 4, weightGrams: 6400, heightMillimeters: 621 },
    { months: 6, weightGrams: 7300, heightMillimeters: 657 },
  ];
  const theoGrowth = [
    { months: 12, weightGrams: 9600, heightMillimeters: 757 },
    { months: 24, weightGrams: 12200, heightMillimeters: 871 },
    { months: 36, weightGrams: 14300, heightMillimeters: 961 },
  ];

  const checkUp = (baby: DemoBaby, visit: { months: number; weightGrams: number; heightMillimeters: number }): DemoAppointment => ({
    id: randomUUID(),
    babyId: baby.id,
    specialistId: pediatrician.id,
    scheduledAt: atClinicHour(addDays(addMonthsClamped(baby.birthDate, visit.months), 2)),
    doctorName: pediatrician.name,
    specialty: pediatrician.specialty,
    location: PEDIATRIC_CLINIC,
    reason: visit.months < 12 ? `Puericultura — ${visit.months} ${visit.months === 1 ? 'mês' : 'meses'}` : `Consulta de rotina — ${visit.months / 12} ${visit.months === 12 ? 'ano' : 'anos'}`,
    notes: 'Crescimento e desenvolvimento adequados para a idade.',
    status: 'COMPLETED',
    weightGrams: visit.weightGrams,
    heightMillimeters: visit.heightMillimeters,
  });

  const appointments: DemoAppointment[] = [
    ...helenaGrowth.map((visit) => checkUp(helena, visit)),
    ...theoGrowth.map((visit) => checkUp(theo, visit)),
    {
      // Inside the three-day window the reminder sweep watches, so the dashboard shows it as next.
      id: randomUUID(),
      babyId: helena.id,
      specialistId: pediatrician.id,
      scheduledAt: atClinicHour(addDays(today, 2)),
      doctorName: pediatrician.name,
      specialty: pediatrician.specialty,
      location: PEDIATRIC_CLINIC,
      reason: 'Puericultura — 7 meses',
      notes: 'Levar a caderneta de vacinação.',
      status: 'SCHEDULED',
      weightGrams: null,
      heightMillimeters: null,
    },
    {
      id: randomUUID(),
      babyId: theo.id,
      specialistId: dentist.id,
      scheduledAt: atClinicHour(addDays(today, 12)),
      doctorName: dentist.name,
      specialty: dentist.specialty,
      location: 'Consultório Sorriso Pequeno',
      reason: 'Primeira consulta no dentista',
      notes: null,
      status: 'SCHEDULED',
      weightGrams: null,
      heightMillimeters: null,
    },
  ];

  const measurements: DemoMeasurement[] = [
    { id: randomUUID(), babyId: helena.id, measuredOn: helena.birthDate, weightGrams: 3200, heightMillimeters: 491 },
    { id: randomUUID(), babyId: theo.id, measuredOn: theo.birthDate, weightGrams: 3300, heightMillimeters: 499 },
  ];

  const milestone = (baby: DemoBaby, title: string, category: MilestoneCategory, achievedAt: Date, description: string | null = null): DemoMilestone => ({
    id: randomUUID(),
    babyId: baby.id,
    title,
    description,
    achievedAt,
    category,
  });

  const milestones: DemoMilestone[] = [
    milestone(helena, 'Primeiro sorriso social', 'SOCIAL', addDays(helena.birthDate, 45), 'Sorriu de volta durante o banho.'),
    milestone(helena, 'Sustentou a cabeça', 'MOTOR', addMonthsClamped(helena.birthDate, 3)),
    milestone(helena, 'Rolou sozinha', 'MOTOR', addDays(addMonthsClamped(helena.birthDate, 5), -5)),
    milestone(helena, 'Primeiras sílabas', 'LANGUAGE', addMonthsClamped(helena.birthDate, 6), 'Repete "ba-ba" e "ma-ma" o dia inteiro.'),
    milestone(helena, 'Sentou sem apoio', 'MOTOR', addDays(today, -6)),
    milestone(theo, 'Primeiros passos', 'MOTOR', addDays(addMonthsClamped(theo.birthDate, 12), 10)),
    milestone(theo, 'Primeiras palavras', 'LANGUAGE', addMonthsClamped(theo.birthDate, 13), '"Água" e "mamã".'),
    milestone(theo, 'Frases de duas palavras', 'LANGUAGE', addMonthsClamped(theo.birthDate, 24)),
    milestone(theo, 'Brincou com outras crianças na escola', 'SOCIAL', addMonthsClamped(theo.birthDate, 30)),
    milestone(theo, 'Desenhou um círculo', 'COGNITIVE', addMonthsClamped(theo.birthDate, 36)),
  ];

  const medications: DemoMedication[] = [
    {
      id: randomUUID(),
      babyId: helena.id,
      name: 'Vitamina D',
      dosage: '2 gotas (400 UI)',
      frequency: '1 vez ao dia',
      reason: 'Suplementação de rotina',
      prescriberName: pediatrician.name,
      startedOn: addDays(helena.birthDate, 7),
      endedOn: null,
      notes: null,
    },
    {
      id: randomUUID(),
      babyId: theo.id,
      name: 'Amoxicilina 250 mg/5 ml',
      dosage: '5 ml',
      frequency: 'De 8 em 8 horas',
      reason: 'Otite média aguda',
      prescriberName: pediatrician.name,
      startedOn: addDays(today, -75),
      endedOn: addDays(today, -65),
      notes: 'Tomar depois das refeições.',
    },
  ];

  return {
    user,
    babies: [helena, theo],
    measurements,
    vaccineRecords: [
      ...appliedDoses(helena, input.vaccines, today, { leaveLatestOverdue: true }),
      ...appliedDoses(theo, input.vaccines, today, { leaveLatestOverdue: false }),
    ],
    specialists: [pediatrician, dentist],
    appointments,
    milestones,
    medications,
  };
}

/**
 * Applied doses for every routine vaccine already due, so the card reads like a family that keeps
 * up — except, for the baby, the latest dose that fell due, left open so the schedule shows what
 * an overdue vaccine looks like. Doses still ahead stay unrecorded and the schedule derives them as
 * pending; conditional and recurring ones are guidance and are left alone.
 */
function appliedDoses(
  baby: DemoBaby,
  vaccines: readonly Vaccine[],
  today: Date,
  options: { leaveLatestOverdue: boolean },
): DemoVaccineRecord[] {
  const due = vaccines
    .filter((vaccine) => vaccine.recommendationKind === 'ROUTINE')
    .map((vaccine) => ({ vaccine, dueDate: addMonthsClamped(baby.birthDate, vaccine.recommendedAgeInMonths) }))
    .filter(({ dueDate }) => dueDate.getTime() < today.getTime())
    // By due date, then code: the catalog orders ties by dose number only, and the dose left open
    // must not depend on the order the database happens to return.
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.vaccine.code.localeCompare(b.vaccine.code));

  const applied = options.leaveLatestOverdue ? due.slice(0, -1) : due;

  return applied.map(({ vaccine, dueDate }, index) => ({
    id: randomUUID(),
    babyId: baby.id,
    vaccineId: vaccine.id,
    // A few days after the due date, as most doses are, and never later than yesterday.
    applicationDate: new Date(Math.min(addDays(dueDate, (index % 4) * 2).getTime(), addDays(today, -1).getTime())),
    batchNumber: `LT${2400 + index * 7}`,
    location: VACCINATION_SITE,
    professional: VACCINATOR,
  }));
}
