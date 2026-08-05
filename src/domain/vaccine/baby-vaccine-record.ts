import { startOfUtcDay } from '../../shared/utils/date';
import { InvalidCustomVaccineNameError } from './errors/invalid-custom-vaccine-name.error';

export type VaccineRecordStatus = 'PENDING' | 'APPLIED' | 'DELAYED';
export type VaccineRecordSource = 'CATALOG' | 'CAMPAIGN' | 'CUSTOM';

export interface BabyVaccineRecordProps {
  id: string;
  babyId: string;
  vaccineId: string | null;
  source: VaccineRecordSource;
  customName: string | null;
  customDose: string | null;
  status: VaccineRecordStatus;
  applicationDate: Date | null;
  notes: string | null;
  batchNumber: string | null;
  location: string | null;
  professional: string | null;
  photoUrl: string | null;
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
  vaccineId: string | null;
  source: VaccineRecordSource;
  customName: string | null;
  customDose: string | null;
  status: VaccineRecordStatus;
  applicationDate: Date | null;
  notes: string | null;
  batchNumber: string | null;
  location: string | null;
  professional: string | null;
  photoUrl: string | null;
}

export interface MarkAppliedProps {
  id: string;
  babyId: string;
  vaccineId: string;
  applicationDate: Date;
  notes?: string | null;
  batchNumber?: string | null;
  location?: string | null;
  professional?: string | null;
  photoUrl?: string | null;
}

export interface RegisterAdhocProps {
  id: string;
  babyId: string;
  source: Exclude<VaccineRecordSource, 'CATALOG'>;
  customName: string;
  customDose?: string | null;
  applicationDate: Date;
  notes?: string | null;
  batchNumber?: string | null;
  location?: string | null;
  professional?: string | null;
  photoUrl?: string | null;
}

export class BabyVaccineRecord {
  readonly id: string;
  readonly babyId: string;
  readonly vaccineId: string | null;
  readonly source: VaccineRecordSource;
  readonly customName: string | null;
  readonly customDose: string | null;
  readonly status: VaccineRecordStatus;
  readonly applicationDate: Date | null;
  readonly notes: string | null;
  readonly batchNumber: string | null;
  readonly location: string | null;
  readonly professional: string | null;
  readonly photoUrl: string | null;

  private constructor(props: BabyVaccineRecordProps) {
    this.id = props.id;
    this.babyId = props.babyId;
    this.vaccineId = props.vaccineId;
    this.source = props.source;
    this.customName = props.customName;
    this.customDose = props.customDose;
    this.status = props.status;
    this.applicationDate = props.applicationDate;
    this.notes = props.notes;
    this.batchNumber = props.batchNumber;
    this.location = props.location;
    this.professional = props.professional;
    this.photoUrl = props.photoUrl;
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
      source: 'CATALOG',
      customName: null,
      customDose: null,
      status,
      applicationDate: null,
      notes: null,
      batchNumber: null,
      location: null,
      professional: null,
      photoUrl: null,
    });
  }

  static markApplied(props: MarkAppliedProps): BabyVaccineRecord {
    return new BabyVaccineRecord({
      id: props.id,
      babyId: props.babyId,
      vaccineId: props.vaccineId,
      source: 'CATALOG',
      customName: null,
      customDose: null,
      status: 'APPLIED',
      applicationDate: props.applicationDate,
      notes: props.notes ?? null,
      batchNumber: props.batchNumber ?? null,
      location: props.location ?? null,
      professional: props.professional ?? null,
      photoUrl: props.photoUrl ?? null,
    });
  }

  // A campaign (e.g. seasonal flu drive) or fully custom vaccine the parent logs by hand — always
  // already applied, and deliberately not tied to a catalog Vaccine row (vaccineId stays null).
  static registerAdhoc(props: RegisterAdhocProps): BabyVaccineRecord {
    const customName = props.customName.trim();

    if (customName.length === 0) {
      throw new InvalidCustomVaccineNameError();
    }

    return new BabyVaccineRecord({
      id: props.id,
      babyId: props.babyId,
      vaccineId: null,
      source: props.source,
      customName,
      customDose: props.customDose ?? null,
      status: 'APPLIED',
      applicationDate: props.applicationDate,
      notes: props.notes ?? null,
      batchNumber: props.batchNumber ?? null,
      location: props.location ?? null,
      professional: props.professional ?? null,
      photoUrl: props.photoUrl ?? null,
    });
  }

  static restore(props: RestoreBabyVaccineRecordProps): BabyVaccineRecord {
    return new BabyVaccineRecord(props);
  }
}
