import { startOfUtcDay } from '../../shared/utils/date';
import { InvalidMedicationNameError } from './errors/invalid-medication-name.error';
import { MedicationEndsBeforeItStartsError } from './errors/medication-ends-before-it-starts.error';

export interface MedicationProps {
  id: string;
  babyId: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  reason: string | null;
  prescriberName: string | null;
  startedOn: Date;
  endedOn: Date | null;
  notes: string | null;
  createdAt: Date;
}

export interface RecordMedicationProps {
  id: string;
  babyId: string;
  name: string;
  startedOn: Date;
  dosage?: string | null;
  frequency?: string | null;
  reason?: string | null;
  prescriberName?: string | null;
  endedOn?: Date | null;
  notes?: string | null;
  createdAt?: Date;
}

/**
 * What a child was prescribed, and when.
 *
 * This is a record, not an instruction, and the entity is written to keep it that way: it has a
 * start, an optional end, and free text for what the prescription said. There is no notion of a
 * next dose, no schedule, and nothing that fires. Every other entity here registers the past; a
 * medication is the first that describes something ongoing, and the line between "this is what was
 * prescribed" and "take this now" is the one thing this model must never blur.
 */
export class Medication {
  readonly id: string;
  readonly babyId: string;
  readonly name: string;
  readonly dosage: string | null;
  readonly frequency: string | null;
  readonly reason: string | null;
  readonly prescriberName: string | null;
  readonly startedOn: Date;
  readonly endedOn: Date | null;
  readonly notes: string | null;
  readonly createdAt: Date;

  private constructor(props: MedicationProps) {
    this.id = props.id;
    this.babyId = props.babyId;
    this.name = props.name;
    this.dosage = props.dosage;
    this.frequency = props.frequency;
    this.reason = props.reason;
    this.prescriberName = props.prescriberName;
    this.startedOn = props.startedOn;
    this.endedOn = props.endedOn;
    this.notes = props.notes;
    this.createdAt = props.createdAt;
  }

  /**
   * A course cannot end before it began.
   *
   * Same-day is allowed on purpose: a single dose given once, started and finished the same day, is
   * a real and common entry — a fever medicine given one afternoon.
   */
  static assertPeriodIsCoherent(startedOn: Date, endedOn: Date | null | undefined): void {
    if (!endedOn) {
      return;
    }

    if (startOfUtcDay(endedOn).getTime() < startOfUtcDay(startedOn).getTime()) {
      throw new MedicationEndsBeforeItStartsError();
    }
  }

  static record(props: RecordMedicationProps): Medication {
    const name = props.name.trim();

    if (name.length === 0) {
      throw new InvalidMedicationNameError();
    }

    Medication.assertPeriodIsCoherent(props.startedOn, props.endedOn);

    return new Medication({
      id: props.id,
      babyId: props.babyId,
      name,
      dosage: normalizeOptional(props.dosage),
      frequency: normalizeOptional(props.frequency),
      reason: normalizeOptional(props.reason),
      prescriberName: normalizeOptional(props.prescriberName),
      startedOn: props.startedOn,
      endedOn: props.endedOn ?? null,
      notes: normalizeOptional(props.notes),
      createdAt: props.createdAt ?? new Date(),
    });
  }

  static restore(props: MedicationProps): Medication {
    return new Medication(props);
  }
}

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
