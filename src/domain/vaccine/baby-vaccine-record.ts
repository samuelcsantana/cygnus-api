import { startOfUtcDay } from '../../shared/utils/date';

export type VaccineRecordStatus = 'PENDING' | 'APPLIED' | 'DELAYED';

export interface BabyVaccineRecordProps {
  id: string;
  babyId: string;
  vaccineId: string;
  status: VaccineRecordStatus;
  applicationDate: Date | null;
  notes: string | null;
}

export interface DeriveBabyVaccineRecordProps {
  id: string;
  babyId: string;
  vaccineId: string;
  dueDate: Date;
  referenceDate?: Date;
}

export interface RestoreBabyVaccineRecordProps {
  id: string;
  babyId: string;
  vaccineId: string;
  status: VaccineRecordStatus;
  applicationDate: Date | null;
  notes: string | null;
}

export interface MarkAppliedProps {
  id: string;
  babyId: string;
  vaccineId: string;
  applicationDate: Date;
  notes?: string | null;
}

export class BabyVaccineRecord {
  readonly id: string;
  readonly babyId: string;
  readonly vaccineId: string;
  readonly status: VaccineRecordStatus;
  readonly applicationDate: Date | null;
  readonly notes: string | null;

  private constructor(props: BabyVaccineRecordProps) {
    this.id = props.id;
    this.babyId = props.babyId;
    this.vaccineId = props.vaccineId;
    this.status = props.status;
    this.applicationDate = props.applicationDate;
    this.notes = props.notes;
  }

  // Compares calendar days, not timestamps, so a vaccine due today is PENDING, not DELAYED.
  static derive(props: DeriveBabyVaccineRecordProps): BabyVaccineRecord {
    const referenceDate = props.referenceDate ?? new Date();
    const status: VaccineRecordStatus =
      startOfUtcDay(props.dueDate).getTime() < startOfUtcDay(referenceDate).getTime() ? 'DELAYED' : 'PENDING';

    return new BabyVaccineRecord({
      id: props.id,
      babyId: props.babyId,
      vaccineId: props.vaccineId,
      status,
      applicationDate: null,
      notes: null,
    });
  }

  static markApplied(props: MarkAppliedProps): BabyVaccineRecord {
    return new BabyVaccineRecord({
      id: props.id,
      babyId: props.babyId,
      vaccineId: props.vaccineId,
      status: 'APPLIED',
      applicationDate: props.applicationDate,
      notes: props.notes ?? null,
    });
  }

  static restore(props: RestoreBabyVaccineRecordProps): BabyVaccineRecord {
    return new BabyVaccineRecord(props);
  }
}
